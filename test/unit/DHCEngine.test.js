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

              DHC.transferOwnership(DHCEngine.address);
          });

          describe('WETH Contract Tests', function () {
              it('Should check for having some weth tokens on balance', async () => {
                  const balance = await weth.balanceOf(deployer.address);
                  assert.equal(balance.toNumber(), 1000e8); // 100000000000
              });
              it('Should allow to mint some tokens', async () => {
                  let balanceUser = await weth.balanceOf(user1.address);
                  assert.equal(balanceUser.toNumber(), 0);
                  await weth.mint(user1.address, '100');
                  balanceUser = await weth.balanceOf(user1.address);
                  assert.equal(balanceUser.toNumber(), 100);
              });
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
              it('Should not allow to deposit collateral with 0 amount of tokens', async () => {
                  await weth.approve(DHCEngine.address, ethers.utils.parseEther('10'));
                  await expect(
                      DHCEngine.depositCollateral(weth.address, ethers.utils.parseEther('0'))
                  ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NeedsMoreThanZero');
              });
          });
      });
