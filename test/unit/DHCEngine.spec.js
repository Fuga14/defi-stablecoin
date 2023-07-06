const { assert, expect } = require('chai');
const { network, deployments, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('DHCEngine Unit Test', () => {
          // contracts variables
          let DHC;
          let DHCEngine;
          let weth, wbtc;
          let deployer, user1, user2;
          let ethUsdPriceFeed, btcUsdPriceFeed;

          beforeEach(async () => {
              [deployer, user1, user2] = await ethers.getSigners();
              await deployments.fixture(['all']);
              weth = await ethers.getContractAt('ERC20Mock', networkConfig[31337].wethAddress);
              wbtc = await ethers.getContractAt('ERC20Mock', networkConfig[31337].wbtcAddress);
              ethUsdPriceFeed = await ethers.getContractAt(
                  'MockV3Aggregator',
                  networkConfig[31337].ethUsdPriceFeed
              );
              btcUsdPriceFeed = await ethers.getContractAt(
                  'MockV3Aggregator',
                  networkConfig[31337].btcUsdPriceFeed
              );
              DHC = await ethers.getContract('DecentralizedHryvnaCoin');
              DHC = await DHC.connect(deployer);
              DHCEngine = await ethers.getContract('DHCEngine');
              DHCEngine = await DHCEngine.connect(deployer);

              // DHC.transferOwnership(DHCEngine.address);
          });

          describe('DHCEngine Constructor Tests', async () => {
              it('Should revert error if length of token addresses is not equal to length of price feed addresses', async () => {
                  const dhcEngineContractFactory = await ethers.getContractFactory('DHCEngine');

                  await expect(
                      dhcEngineContractFactory.deploy(
                          [weth.address, wbtc.address],
                          [ethUsdPriceFeed.address],
                          DHC.address
                      )
                  ).to.be.revertedWithCustomError(
                      DHCEngine,
                      'DHCEngine__TokenAddressesAndPriceFeedAddressesMustBeSameLength'
                  );
              });

              it('Should return correct price feed address of token', async () => {
                  const wethTokenAddress = weth.address;
                  const expectedWethPriceFeedAddress = ethUsdPriceFeed.address;
                  const wethTokenPriceFeedAddress = await DHCEngine.getTokenPriceFeedAddress(
                      wethTokenAddress
                  );
                  assert.equal(wethTokenPriceFeedAddress, expectedWethPriceFeedAddress);

                  const wbtcTokenAddress = wbtc.address;
                  const expectedWbtcPriceFeedAddress = btcUsdPriceFeed.address;
                  const wbtcTokenPriceFeedAddress = await DHCEngine.getTokenPriceFeedAddress(
                      wbtcTokenAddress
                  );
                  assert.equal(wbtcTokenPriceFeedAddress, expectedWbtcPriceFeedAddress);
              });

              it('Should add all token collateral addresses into 1 single array', async () => {
                  const expectedArrayOfTokens = [weth.address, wbtc.address];
                  const tokenCollateralAddress = await DHCEngine.getCollateralTokens();
                  assert.deepEqual(tokenCollateralAddress, expectedArrayOfTokens);
              });
          });

          describe('DHCEngine Price Tests', function () {
              it('Should return value in usd of eth amount', async () => {
                  const ethAmount = ethers.utils.parseEther('10');
                  const expectedUsd = '20000000000000000000000'; // 10e18 * $ETH 2000 = 20000e18
                  const usdValue = await DHCEngine.getUsdValue(weth.address, ethAmount);
                  assert.equal(usdValue.toString(), expectedUsd);
              });

              it('Should return eth amount converted from usd amount', async () => {
                  const expectedEthAmount = '1';
                  const usdAmount = '2000';
                  const token = weth.address;

                  const ethAmountFromUsd = await DHCEngine.getTokenAmountFromUsd(token, usdAmount);
                  assert.equal(ethAmountFromUsd.toString(), expectedEthAmount);
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
