const { assert, expect } = require('chai');
const { network, deployments, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('DHCEngine Unit Test', () => {
          let DHC;
          let DHCEngine;
          let weth;
          let deployer, user1, user2;

          beforeEach(async () => {
              [deployer, user1, user2] = await ethers.getSigners();
              await deployments.fixture(['all']);
              weth = await ethers.getContractAt('ERC20Mock', networkConfig[31337].wethAddress);
              DHC = await ethers.getContract('DecentralizedHryvnaCoin');
              DHC = await DHC.connect(deployer);
              DHCEngine = await ethers.getContract('DHCEngine');
              DHCEngine = await DHCEngine.connect(deployer);
              //   DHC.transferOwnership(DHCEngine.address);
          });

          describe('DHCEngine Price Tests', function () {
              it('Should return value in usd of eth amount', async () => {
                  const ethAmount = ethers.utils.parseEther('10');
                  const expectedUsd = '20000000000000000000000'; // 10e18 * $ETH 2000 = 20000e18
                  const usdValue = await DHCEngine.getUsdValue(weth.address, ethAmount);
                  assert.equal(usdValue.toString(), expectedUsd);
              });
          });

          describe('DHCEngine Deposit Collateral Tests', () => {
              it('Should return error if deposit amount is 0', async () => {
                  await weth.approve(DHCEngine.address, ethers.utils.parseEther('10'));
                  await expect(
                      DHCEngine.depositCollateral(weth.address, ethers.utils.parseEther('0'))
                  ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NeedsMoreThanZero');
              });

              it('Should return error if deposit token is now allowed', async () => {
                  const fakeRandomAddress = ethers.Wallet.createRandom();
                  await expect(
                      DHCEngine.depositCollateral(
                          fakeRandomAddress.address,
                          ethers.utils.parseEther('10')
                      )
                  ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NotAllowedToken');
              });

              it('Should emit event when we successfully deposit some collateral', async () => {
                  const tokenCollaterAddress = weth.address;
                  const amountCollateral = ethers.utils.parseEther('1');

                  await weth.approve(DHCEngine.address, ethers.utils.parseEther('1'));
                  weth.mint(deployer.address, amountCollateral);

                  await expect(DHCEngine.depositCollateral(tokenCollaterAddress, amountCollateral))
                      .to.emit(DHCEngine, 'CollateralDeposited')
                      .withArgs(deployer.address, tokenCollaterAddress, amountCollateral);
              });
          });
      });
