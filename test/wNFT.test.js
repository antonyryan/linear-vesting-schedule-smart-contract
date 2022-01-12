const { expect } = require('chai')
const { ethers } = require("hardhat")

const serviceFeeRatio = 5

describe('wNFT', () => {
  before(async () => {
    const users = await ethers.getSigners()
    this.users = users.slice(2)
    const [alice] = users
    
    const MockNFT = await ethers.getContractFactory('MockNFT')
    const wNFT = await ethers.getContractFactory('wNFT')

    this.mockNFT = await MockNFT.deploy()
    this.wnft = await wNFT.deploy(serviceFeeRatio)
    
    await this.mockNFT.connect(alice).mint(alice.address, 0)
    
    this.owner = alice
  })

  // it('register function fails', async () => {
  //   const tokenId = 0
  //   const minRentalPeriod = 2
  //   const maxRentalPeriod = 10
  //   const dailyRate = 20
    
  //   await this.mockNFT.approve(this.wnft.address, tokenId);

  //   await expect(this.wnft.connect(this.owner).register(
  //     this.mockNFT.address,
  //     tokenId,
  //     minRentalPeriod,
  //     maxRentalPeriod,
  //     dailyRate
  //   )).to.revertedWith('wNFT: caller is not the owner of the NFT')
  // })

  it('register function succeeds', async () => {
    const tokenId = 0
    const minRentalPeriod = 2
    const maxRentalPeriod = 10
    const dailyRate = 20
    
    await this.mockNFT.approve(this.wnft.address, tokenId);

    await expect(this.wnft.connect(this.owner).register(
      this.mockNFT.address,
      tokenId,
      minRentalPeriod,
      maxRentalPeriod,
      dailyRate
    )).to.emit(this.wnft, 'Registered')
    .withArgs(this.owner.address, this.mockNFT.address, tokenId)
  })

  it('unregister function succeeds', async () => {
    const tokenId = 0
    
    // await expect(this.wnft.connect(this.owner).unregister(
    //   tokenId,
    // )).to.emit(this.wnft, 'Unregistered')
    // .withArgs(this.owner.address, this.mockNFT.address, tokenId)
    
  })

})

