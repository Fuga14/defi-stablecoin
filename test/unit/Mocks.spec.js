const { assert, expect } = require('chai');
const { network, deployments, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Mocks Unit Test', () => {
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
      });
