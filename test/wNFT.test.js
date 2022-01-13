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
  })

  it('register function fails', async () => {
    const [bob] = this.users
    const tokenId = 0
    const minRentalPeriod = 2
    const maxRentalPeriod = 10
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
    const anotherTokenId = 1
    const minRentalPeriod = 2
    const maxRentalPeriod = 10
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

    await this.mockNFT.approve(this.wnft.address, anotherTokenId);

    await expect(this.wnft.connect(this.nftOwner).register(
      this.mockNFT.address,
      anotherTokenId,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.emit(this.wnft, 'Registered')
    .withArgs(this.nftOwner.address, this.mockNFT.address, anotherTokenId)

    const wrap = await this.wnft.wraps(0);
  })

  it('requestRent function succeeds', async () => {
    const [renter] = this.users
    const tokenId = 1
    const requestPeriod = 5
    const minRentalPeriod = 2
    const maxRentalPeriod = 10
    const rentStarted = 0
    const dailyRate = 20

    const wrap = await this.wnft.wraps(tokenId)
    
    await expect(this.wnft.connect(renter).requestRent(
      tokenId,
      requestPeriod,
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
        
    const tokenStatus = await this.wnft.tokenStatus(tokenId)
  })

  it('requestRent function fails', async () => {
    const tokenId = 0
    const anotherTokenId = 1
    const requestPeriod = 5
    
    await expect(this.wnft.connect(this.nftOwner).requestRent(
      anotherTokenId,
      requestPeriod,
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
      requestPeriod,
      { value: 50 }
    )).to.revertedWith('wNFT: invalid upfront amount')
  })

  it('unregister function fails', async () => {
    const tokenId = 0
    const anotherTokenId = 1
    const [bob] = this.users
    
    await expect(this.wnft.connect(this.nftOwner).unregister(
      anotherTokenId
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

