const { expect } = require('chai')
const { ethers, BigNumber } = require("hardhat")

const serviceFeeRatio = 5

describe('wNFT', () => {
  before(async () => {
    const users = await ethers.getSigners()

    this.nftOwner = users[0]
    this.users = users.slice(1)

    const MockNFT = await ethers.getContractFactory('MockNFT')
    const wNFT = await ethers.getContractFactory('wNFT')

    this.mockNFT = await MockNFT.deploy()
    this.wnft = await wNFT.deploy(serviceFeeRatio)

    await this.mockNFT.connect(this.nftOwner).mint(this.nftOwner.address, 0)
    await this.mockNFT.connect(this.nftOwner).mint(this.nftOwner.address, 1)
    await this.mockNFT.connect(this.nftOwner).mint(this.nftOwner.address, 2)
  })

  it('register function fails', async () => {
    const [bob] = this.users
    const tokenId = 0
    const minRentalPeriod = 2 * 3600 * 24
    const maxRentalPeriod = 10 * 3600 * 24
    const dailyRate = 20

    await expect(this.wnft.connect(bob).register(
      this.mockNFT.address,
      tokenId,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.revertedWith('wNFT: caller is not the owner of the NFT')

    await expect(this.wnft.connect(this.nftOwner).register(
      this.wnft.address,
      tokenId,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.revertedWith('wNFT: cannot register wNFT')

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      tokenId,
      0,
      maxRentalPeriod,
      dailyRate
    )).to.revertedWith('wNFT: zero min rental period')

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      tokenId,
      minRentalPeriod,
      1,
      dailyRate
    )).to.revertedWith('wNFT: invalid max rental period')

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      tokenId,
      minRentalPeriod,
      maxRentalPeriod,
      0
    )).to.revertedWith('wNFT: zero daily rate')
  })

  it('register function succeeds', async () => {
    const tokenId = 0
    const tokenId1 = 1
    const tokenId2 = 2
    const minRentalPeriod = 2 * 3600 * 24
    const maxRentalPeriod = 10 * 3600 * 24
    const dailyRate = 20

    await this.mockNFT.approve(this.wnft.address, tokenId);

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      tokenId,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.emit(this.wnft, 'Registered')
      .withArgs(this.nftOwner.address, this.mockNFT.address, tokenId)

    await this.mockNFT.approve(this.wnft.address, tokenId1);

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      tokenId1,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.emit(this.wnft, 'Registered')
      .withArgs(this.nftOwner.address, this.mockNFT.address, tokenId1)

    await this.mockNFT.approve(this.wnft.address, tokenId2);

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      tokenId2,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.emit(this.wnft, 'Registered')
      .withArgs(this.nftOwner.address, this.mockNFT.address, tokenId2)

    const wrap = await this.wnft.wraps(0);
  })

  it('requestRent function succeeds', async () => {
    const [renter] = this.users
    const tokenId = 1
    const tokenId2 = 2
    const rentalPeriodInDays = 5
    const requestPeriod = rentalPeriodInDays * 3600 * 24
    const minRentalPeriod = 2 * 3600 * 24
    const maxRentalPeriod = 10 * 3600 * 24
    const rentStarted = 0
    const dailyRate = 20

    const wrap = await this.wnft.wraps(tokenId)

    await expect(this.wnft.connect(renter).requestRent(
      tokenId,
      rentalPeriodInDays,
      { value: 100 }
    )).to.emit(this.wnft, 'RentRequested')
      .withArgs(
        renter.address,
        this.nftOwner.address,
        tokenId,
        [
          this.mockNFT.address,
          renter.address,
          this.nftOwner.address,
          minRentalPeriod,
          maxRentalPeriod,
          requestPeriod,
          rentStarted,
          dailyRate,
          tokenId
        ]
      )

    await expect(this.wnft.connect(renter).requestRent(
      tokenId2,
      rentalPeriodInDays,
      { value: 100 }
    )).to.emit(this.wnft, 'RentRequested')
      .withArgs(
        renter.address,
        this.nftOwner.address,
        tokenId2,
        [
          this.mockNFT.address,
          renter.address,
          this.nftOwner.address,
          minRentalPeriod,
          maxRentalPeriod,
          requestPeriod,
          rentStarted,
          dailyRate,
          tokenId2
        ]
      )

    const tokenStatus = await this.wnft.tokenStatus(tokenId)
  })

  it('requestRent function fails', async () => {
    const tokenId = 0
    const tokenId1 = 1
    const rentalPeriodInDays = 5

    await expect(this.wnft.connect(this.nftOwner).requestRent(
      tokenId1,
      rentalPeriodInDays,
      { value: 100 }
    )).to.revertedWith('wNFT: token in rent')

    await expect(this.wnft.connect(this.nftOwner).requestRent(
      tokenId,
      1,
      { value: 100 }
    )).to.revertedWith('wNFT: out of minimal rental period')

    await expect(this.wnft.connect(this.nftOwner).requestRent(
      tokenId,
      10,
      { value: 100 }
    )).to.revertedWith('wNFT: out of maximal rental period')

    await expect(this.wnft.connect(this.nftOwner).requestRent(
      tokenId,
      rentalPeriodInDays,
      { value: 50 }
    )).to.revertedWith('wNFT: invalid upfront amount')
  })

  it('approveRentRequest function fails', async () => {
    const tokenId = 0
    const tokenId1 = 1
    const [bob] = this.users

    await expect(this.wnft.connect(bob).approveRentRequest(
      tokenId1,
      true
    )).to.revertedWith('wNFT: caller is not the token owner')

    await expect(this.wnft.connect(this.nftOwner).approveRentRequest(
      tokenId,
      true
    )).to.revertedWith('wNFT: not requested')
  })

  it('approveRentRequest function succeeds', async () => {
    const tokenId1 = 1
    const tokenId2 = 2
    const rentalPeriodInDays = 5
    const requestPeriod = rentalPeriodInDays * 3600 * 24
    const minRentalPeriod = 2 * 3600 * 24
    const maxRentalPeriod = 10 * 3600 * 24
    const rentStarted = 0
    const dailyRate = 20
    const renter = '0x0000000000000000000000000000000000000000'

    await this.wnft.connect(this.nftOwner).approveRentRequest(
      tokenId2,
      true
    )

    const wrap = await this.wnft.wraps(2)
    const wrapStatus = await this.wnft.tokenStatus(2)

    await expect(this.wnft.connect(this.nftOwner).approveRentRequest(
      tokenId1,
      false
    )).to.emit(this.wnft, 'RentDenied')
      .withArgs(
        renter,
        this.nftOwner.address,
        tokenId1,
        [
          this.mockNFT.address,
          renter,
          this.nftOwner.address,
          minRentalPeriod,
          maxRentalPeriod,
          requestPeriod,
          rentStarted,
          dailyRate,
          tokenId1
        ]
      )
  })

  it('unregister function fails', async () => {
    const tokenId = 0
    const tokenId2 = 2
    const [bob] = this.users

    await expect(this.wnft.connect(this.nftOwner).unregister(
      tokenId2
    )).to.revertedWith('wNFT: cannot unregister non free wrap')

    await expect(this.wnft.connect(bob).unregister(
      tokenId
    )).to.revertedWith('wNFT: only token owner can unregister')
  })

  it('unregister function succeeds', async () => {
    const tokenId = 0

    await expect(this.wnft.connect(this.nftOwner).unregister(
      tokenId,
    )).to.emit(this.wnft, 'Unregistered')
      .withArgs(this.nftOwner.address, this.mockNFT.address, tokenId)
  })

})

