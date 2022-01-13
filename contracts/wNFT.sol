//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";
import "./interfaces/IERC721URI.sol";

contract wNFT is IERC721Receiver, ERC721Enumerable, Ownable, ReentrancyGuard {
    enum WrapStatus {
        FREE,
        REQUEST_PENDING,
        RENTED
    }

    /// @dev keep original NFT data
    struct Wrap {
        IERC721URI nftAddr;
        address renter;
        address owner;
        /// @dev min rental period in days, set by token owner
        uint256 minRentalPeriod;
        /// @dev max rental period in days, set by token owner
        uint256 maxRentalPeriod;
        /// @dev rental period in days, actually agreed between renter and owner
        uint256 rentalPeriod;
        /// @dev rent start timestamp
        uint256 rentStarted;
        uint256 dailyRate;
        uint256 tokenId;
    }

    /// @dev token id tracker
    uint256 internal tokenIdTracker;

    /// @dev token id => wrap
    mapping(uint256 => Wrap) public wraps;

    /// @dev owner address => amount
    mapping(address => uint256) public ownerBalance;

    /// @dev service fee balance
    uint256 public serviceFeeBalance;

    /// @dev service fee percentage
    uint256 public serviceFeeRatio;

    event Registered(address owner, address nftAddr, uint256 tokenId);

    event RentRequested(
        address renter,
        address owner,
        uint256 tokenId,
        Wrap data
    );

    event RentStarted(
        address renter,
        address owner,
        uint256 tokenId,
        Wrap data
    );

    event RentEnded(address renter, address owner, uint256 tokenId, Wrap data);

    event RentDenied(address renter, address owner, uint256 tokenId, Wrap data);

    event Unregistered(address owner, address nftAddr, uint256 tokenId);

    event ServiceFeeRatioSet(uint256 percentage);

    event OwnerBalanceWithdrawn(address owner, uint256 amount);

    event ServiceFeeBalanceWithdrawn(address recipient, uint256 amount);

    /**
     * @dev constructor
     */
    constructor(uint256 _serviceFeeRatio)
        ERC721("wNFT", "wNFT")
        Ownable()
        ReentrancyGuard()
    {
        require(_serviceFeeRatio < 100, "wNFT: invalid service fee");
        serviceFeeRatio = _serviceFeeRatio;
    }

    modifier onlyValidToken(uint256 tokenId) {
        require(_exists(tokenId), "wNFT: invalid wrap token id");
        _;
    }

    /**
     * @dev Registers token and mint wNFT to the token owner
     * @param nftAddr token address
     * @param tokenId token id
     * @param minRentalPeriod min rental period in days
     * @param maxRentalPeriod max rental period in days
     * @param dailyRate daily rate
     */
    function register(
        address nftAddr,
        uint256 tokenId,
        uint256 minRentalPeriod,
        uint256 maxRentalPeriod,
        uint256 dailyRate
    ) external payable {
        require(nftAddr != address(this), "wNFT: cannot register wNFT");
        
        address owner = IERC721URI(nftAddr).ownerOf(tokenId);
        require(
            msg.sender == owner,
            "wNFT: caller is not the owner of the NFT"
        );
        require(minRentalPeriod > 0, "wNFT: zero min rental period");
        require(
            maxRentalPeriod > minRentalPeriod,
            "wNFT: invalid max rental period"
        );
        require(dailyRate > 0, "wNFT: zero daily rate");

        uint256 newTokenId = tokenIdTracker;
        Wrap storage wrap = wraps[newTokenId];

        tokenIdTracker += 1;

        // store original nft data
        wrap.nftAddr = IERC721URI(nftAddr);
        wrap.owner = owner;
        wrap.tokenId = tokenId;
        wrap.minRentalPeriod = minRentalPeriod;
        wrap.maxRentalPeriod = maxRentalPeriod;
        wrap.dailyRate = dailyRate;

        // escrow the nft
        wrap.nftAddr.safeTransferFrom(owner, address(this), tokenId);
        // mint wNFT
        _safeMint(address(this), newTokenId);

        emit Registered(msg.sender, nftAddr, tokenId);
    }

    /**
     * @dev Unregisters wrap and send tokenb back to the owner
     * @param tokenId wrap token id
     */
    function unregister(uint256 tokenId) external onlyValidToken(tokenId) {
        Wrap storage wrap = wraps[tokenId];
        address nftAddr = address(wrap.nftAddr);

        require(
            tokenStatus(tokenId) == WrapStatus.FREE,
            "wNFT: cannot unregister non free wrap"
        );
        require(
            wrap.owner == msg.sender,
            "wNFT: only token owner can unregister"
        );

        _burn(tokenId);
        tokenId = wrap.tokenId;

        wrap.nftAddr.safeTransferFrom(address(this), msg.sender, tokenId);
        delete wraps[tokenId];
        
        emit Unregistered(msg.sender, nftAddr, tokenId);
    }

    /**
     * @dev Returns wrap token status
     * @param tokenId wrap token id
     */
    function tokenStatus(uint256 tokenId)
        public
        view
        onlyValidToken(tokenId)
        returns (WrapStatus)
    {
        Wrap storage wrap = wraps[tokenId];
        if (wrap.renter == address(0)) {
            return WrapStatus.FREE;
        } else if (wrap.rentStarted == 0) {
            return WrapStatus.REQUEST_PENDING;
        } else if (wrap.rentStarted + wrap.rentalPeriod < block.timestamp) {
            return WrapStatus.FREE;
        } else {
            return WrapStatus.RENTED;
        }
    }

    /**
     * @dev Sends a rent request with upfront
     * @param tokenId wrap token id
     * @param rentalPeriodInDays rental period in days
     */
    function requestRent(uint256 tokenId, uint256 rentalPeriodInDays)
        external
        payable
        onlyValidToken(tokenId)
    {
        Wrap storage wrap = wraps[tokenId];
        uint256 rentalPeriod = rentalPeriodInDays * 1 days;

        require(tokenStatus(tokenId) == WrapStatus.FREE, "wNFT: token in rent");
        require(
            wrap.minRentalPeriod < rentalPeriod,
            "wNFT: out of minimal rental period"
        );
        require(
            wrap.maxRentalPeriod > rentalPeriod,
            "wNFT: out of maximal rental period"
        );
        require(
            msg.value == rentalPeriodInDays * wrap.dailyRate,
            "wNFT: invalid upfront amount"
        );

        wrap.rentalPeriod = rentalPeriod;
        wrap.renter = msg.sender;

        emit RentRequested(msg.sender, wrap.owner, tokenId, wrap);
    }

    /**
     * @dev Approves the request rent and initiates the rent if approved
     * @param tokenId wrap token id
     * @param approve approve or deny
     */
    function approveRentRequest(uint256 tokenId, bool approve)
        external
        onlyValidToken(tokenId)
    {
        Wrap storage wrap = wraps[tokenId];

        require(
            wrap.owner == msg.sender,
            "wNFT: caller is not the token owner"
        );
        require(
            tokenStatus(tokenId) == WrapStatus.REQUEST_PENDING,
            "wNFT: not requested"
        );

        if (approve) {
            wrap.rentStarted = block.timestamp;
            ERC721._transfer(address(this), wrap.renter, tokenId);
            emit RentStarted(wrap.renter, msg.sender, tokenId, wrap);
        } else {
            // refund the upfront if the request is not approved
            address renter = wrap.renter;
            wrap.renter = address(0);

            payable(renter).call{value: wrap.rentalPeriod * wrap.dailyRate}("");
            emit RentDenied(wrap.renter, msg.sender, tokenId, wrap);
        }
    }

    /**
     * @dev Sets service fee ratio
     * @param percentage ratio
     */
    function setServiceFeeRatio(uint256 percentage) external onlyOwner {
        require(percentage < 100, "wNFT: invalid service fee");
        serviceFeeRatio = percentage;

        emit ServiceFeeRatioSet(percentage);
    }

    /**
     * @dev Complete rent
     * @param tokenId wrap token id
     */
    function completeRent(uint256 tokenId)
        external
        onlyValidToken(tokenId)
        nonReentrant
    {
        require(
            tokenStatus(tokenId) == WrapStatus.RENTED,
            "wNFT: only violated token"
        );

        Wrap storage wrap = wraps[tokenId];
        address renter = wrap.renter;
        uint256 rentalFee = wrap.rentalPeriod * wrap.dailyRate;

        wrap.renter = address(0);
        ERC721._transfer(renter, address(this), tokenId);

        uint256 serviceFees = (rentalFee * serviceFeeRatio) / 100;
        uint256 netRentalFeeToOwner = rentalFee - serviceFees;

        ownerBalance[wrap.owner] += netRentalFeeToOwner;
        serviceFeeBalance += serviceFees;

        emit RentEnded(renter, wrap.owner, tokenId, wrap);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        onlyValidToken(tokenId)
        returns (string memory)
    {
        Wrap storage wrap = wraps[tokenId];
        return wrap.nftAddr.tokenURI(wrap.tokenId);
    }

    function _transfer(
        address,
        address,
        uint256
    ) internal pure override {
        revert("wNFT: can't transfer");
    }

    function withdrawOwnerBalance(address owner) external nonReentrant {
        uint256 amount = ownerBalance[owner];
        if (amount > 0) {
            ownerBalance[owner] = 0;
            (bool success, ) = payable(owner).call{value: amount}("");
            require(success);

            emit OwnerBalanceWithdrawn(owner, amount);
        }
    }

    function withdrawServiceFeeBalance(address recipient)
        external
        onlyOwner
        nonReentrant
    {
        uint256 amount = serviceFeeBalance;
        if (amount > 0) {
            serviceFeeBalance = 0;
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success);

            emit ServiceFeeBalanceWithdrawn(recipient, amount);
        }
    }

    /**
     * @dev {IERC721Receiver-onERC721Received}
     *      This function ensures wNFT can mint tokens to itself, or be an owner of another NFT
     */
    function onERC721Received(
        address operator,
        address from,
        uint256,
        bytes calldata
    ) external override view returns (bytes4) {
        if (operator == address(this) || from == address(0)) {
            return IERC721Receiver.onERC721Received.selector;
        } else {
            return 0x00;
        }
    }
}
