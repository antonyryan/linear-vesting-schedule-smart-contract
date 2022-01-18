# Linear Vesting Schedule

This project creates linear vesting schedules for any ERC20 tokens. Anyone who owns their shedule can redeem tokens from the schedule id. The amount of redemption is decided by elapsed time.

## Compile & Test

Compile solidity contracts and run the test suite with:

```shell
npx hardhat compile
npx hardhat test
npx hardhat coverage
```

## LinearVestingSchedule Contract
We can create a new vesting schedule and redeem tokens by calling two functions below:
### mint(ERC20Token, to, amount, time)
For example, a user calls mint("0xD533a949740bb3306d119CC777fa900bA034cd52", toAddr, 1e20, 1
year) on ethereum (the first param is CRV's token addie) would allow toAddr to redeem() 100 CRV tokens
(CRV is 18 decimals) over a year. Of course whoever calls mint() needs to provide all the tokens upfront.
The redeem() schedule is linear so that means at 1/4 year toAddr can redeem() 25 CRVs, at half year,
toAddr can redeem up to 50 CRV. There's also no cliff so toAddr can start redeeming CRV tokens as
soon as they receives it. It's just the amount they can redeem would be small

### redeem(scheduleId)
A user can redeem from that one particular schedule, which is already implied the token address. T

## Uint test of LinearVestingContract
For uint test, MockERC20Token Contract is used.
### MockERC20Token Contract
It is a mock contract for only unit test.
### Test
All possible test cases which I noticed are reflected in unit test. These test cases may be possible pitfalls. One pitfall I am concerned about seriously is to call redeem function after expired date(time in mint function). In this case it is very important to calculate correct redeeming amount. So I implemented this like below:
        
        uint256 elapsedTime = block.timestamp - vestingSchedule.lastRedeemTime;
        uint256 remainingTimeTillExpiration = vestingSchedule.createdAt + vestingSchedule.time - vestingSchedule.lastRedeemTime; 
        uint256 actualElapsedTime = Math.min(remainingTimeTillExpiration, elapsedTime);
        uint256 redeemAmount = vestingSchedule.amount * actualElapsedTime / vestingSchedule.time;


