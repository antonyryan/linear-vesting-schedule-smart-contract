const { expect } = require('chai')
const { ethers } = require("hardhat")
const serviceFeeRatio = 10

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
    const tokenId1 = 1
    const tokenId2 = 2
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

  })

  it('requestRent function succeeds', async () => {
    const [renter] = this.users
    const tokenId = 1
    const tokenId2 = 2
    const requestPeriod = 6
    const minRentalPeriod = 2
    const maxRentalPeriod = 10
    const rentStarted = 0
    const dailyRate = 20

    const wrap = await this.wnft.wraps(tokenId)

    await expect(this.wnft.connect(renter).requestRent(
      tokenId,
      requestPeriod,
      { value: requestPeriod * dailyRate }
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
      requestPeriod,
      { value: requestPeriod * dailyRate }
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
    const requestPeriod = 6

    await expect(this.wnft.connect(this.nftOwner).requestRent(
      tokenId1,
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
    const requestPeriod = 6
    const minRentalPeriod = 2
    const maxRentalPeriod = 10
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

  it('wNFT is not transferable', async () => {
    const [renter, john] = this.users
    const tokenId2 = 2

    await expect(this.wnft.connect(renter).transferFrom(
      renter.address,
      john.address,
      tokenId2
    )).to.revertedWith("wNFT: can't transfer")
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

  it('setServiceFeeRatio function fails', async () => {
    const percentage = 200

    await expect(this.wnft.connect(this.nftOwner).setServiceFeeRatio(
      percentage
    )).to.revertedWith('wNFT: invalid service fee')
  })

  it('setServiceFeeRatio function succeeds', async () => {
    const percentage = serviceFeeRatio

    await expect(this.wnft.connect(this.nftOwner).setServiceFeeRatio(
      percentage
    )).to.emit(this.wnft, 'ServiceFeeRatioSet')
      .withArgs(percentage)
  })

  it('completeRent function fails', async () => {
    const tokenId1 = 1 // free
    const tokenId2 = 2 // rented

    await expect(this.wnft.connect(this.nftOwner).completeRent(
      tokenId1
    )).to.revertedWith('wNFT: only rented token')
  })

  it('completeRent function succeeds', async () => {
    const tokenId2 = 2
    const renter = '0x0000000000000000000000000000000000000000'

    const wrap = await this.wnft.wraps(tokenId2)

    await expect(this.wnft.connect(this.nftOwner).completeRent(
      tokenId2
    )).to.emit(this.wnft, 'RentEnded')
      .withArgs(
        wrap.renter,
        wrap.owner,
        tokenId2,
        [
          wrap[0],
          renter,
          wrap[2],
          wrap[3],
          wrap[4],
          wrap[5],
          wrap[6],
          wrap[7],
          wrap[8]
        ]
      )

    const ownerBalance = await this.wnft.ownerBalance(wrap[2])
    const serviceFeeBalance = await this.wnft.serviceFeeBalance()
    const wrapStatus = await this.wnft.tokenStatus(tokenId2)

    // console.log(ownerBalance, serviceFeeBalance.toNumber(), wrapStatus)
  })

  it('withdrawOwnerBalance function succeeds', async () => {
    const tokenId2 = 2
    const wrap = await this.wnft.wraps(tokenId2)
    const ownerBalance = await this.wnft.ownerBalance(wrap[tokenId2])

    await expect(this.wnft.connect(this.nftOwner).withdrawOwnerBalance(
      wrap[2],
    )).to.emit(this.wnft, 'OwnerBalanceWithdrawn')
      .withArgs(wrap[2], ownerBalance)
  })

  it('withdrawServiceFeeBalance function succeeds', async () => {
    const [bob] = this.users
    const serviceFeeBalance = (await this.wnft.serviceFeeBalance()).toNumber()

    await expect(this.wnft.connect(this.nftOwner).withdrawServiceFeeBalance(
      bob.address,
    )).to.emit(this.wnft, 'ServiceFeeBalanceWithdrawn')
      .withArgs(bob.address, serviceFeeBalance)
  })
})
