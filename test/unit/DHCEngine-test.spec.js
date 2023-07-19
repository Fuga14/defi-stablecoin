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

      const AMOUNT_TO_MINT = ethers.utils.parseEther('10');
      const UINT256_MAX =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      const MIN_HEALTH_FACTOR = ethers.utils.parseEther('1');

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
        // DHC = await DHC.connect(deployer);
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
            DHCEngine.depositCollateral(fakeRandomAddress.address, ethers.utils.parseEther('10'))
          ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NotAllowedToken');
        });

        it('Should return error if transfer is unapproved', async () => {
          // To make error we need to skip approve function
          weth.mint(deployer.address, AMOUNT_TO_MINT);
          const tokenCollaterAddress = weth.address;
          const amountCollateral = ethers.utils.parseEther('1');
          await expect(
            DHCEngine.depositCollateral(tokenCollaterAddress, amountCollateral)
          ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
        });

        it('Should emit event when we successfully deposit some collateral', async () => {
          weth.mint(deployer.address, AMOUNT_TO_MINT);
          const tokenCollaterAddress = weth.address;
          const amountCollateral = ethers.utils.parseEther('1');

          await weth.approve(DHCEngine.address, ethers.utils.parseEther('1'));

          await expect(DHCEngine.depositCollateral(tokenCollaterAddress, amountCollateral))
            .to.emit(DHCEngine, 'CollateralDeposited')
            .withArgs(deployer.address, tokenCollaterAddress, amountCollateral);
        });

        it('Should get correct account information after making deposit ', async () => {
          weth.mint(deployer.address, AMOUNT_TO_MINT);
          const tokenCollaterAddress = weth.address;
          const amountCollateral = ethers.utils.parseEther('1');

          await weth.approve(DHCEngine.address, ethers.utils.parseEther('1'));
          await DHCEngine.depositCollateral(tokenCollaterAddress, amountCollateral);
          const collateralDepositedInUsd = await DHCEngine.getUsdValue(
            tokenCollaterAddress,
            amountCollateral
          );

          const { totalDhcMinted, collateralValueInUsd } = await DHCEngine.getAccountInformation(
            deployer.address
          );

          const amountDeposited = await DHCEngine.getCollateralDepositedAmountOfUser(
            deployer.address,
            tokenCollaterAddress
          );
          assert.equal(amountDeposited.toString(), amountCollateral.toString());
          // assert.equal(collateralDepositedInUsd, collateralValueInUsd);
          assert.equal(collateralDepositedInUsd.toString(), collateralValueInUsd.toString());
        });

        it('Should allow to make deposit collateral without minting dhc', async () => {
          weth.mint(deployer.address, AMOUNT_TO_MINT);
          const tokenCollaterAddress = weth.address;
          const amountCollateral = ethers.utils.parseEther('1');

          await weth.approve(DHCEngine.address, ethers.utils.parseEther('1'));
          await DHCEngine.depositCollateral(tokenCollaterAddress, amountCollateral);
          const userDhcBalance = await DHC.balanceOf(deployer.address);
          assert.equal(userDhcBalance.toString(), '0');
        });

        it('Should reverts error if transfer failed', async () => {
          const failedTransferFromFactory = await ethers.getContractFactory(
            'MockFailedTransferFrom'
          );
          const failedTransferFrom = await failedTransferFromFactory.deploy();
          await failedTransferFrom.deployed();

          const dhcEngineFactory = await ethers.getContractFactory('DHCEngine');
          const dhcEngine = await dhcEngineFactory.deploy(
            [failedTransferFrom.address],
            [ethUsdPriceFeed.address],
            failedTransferFrom.address
          );
          await dhcEngine.deployed();

          await failedTransferFrom.mint(deployer.address, AMOUNT_TO_MINT);
          await failedTransferFrom.approve(dhcEngine.address, AMOUNT_TO_MINT);

          await failedTransferFrom.transferOwnership(dhcEngine.address);

          const tokenCollateralAddress = failedTransferFrom.address;
          const collateralValue = ethers.utils.parseEther('1');

          await expect(
            dhcEngine.depositCollateral(tokenCollateralAddress, collateralValue)
          ).to.be.revertedWithCustomError(dhcEngine, 'DHCEngine__TransferFailed');
        });
      });

      describe('Mint DHC Tests', () => {
        it('Should revert error if mint amount is 0', async () => {
          const amountDhcToMint = 0;
          await expect(DHCEngine.mintDhc(amountDhcToMint)).to.be.revertedWithCustomError(
            DHCEngine,
            'DHCEngine__NeedsMoreThanZero'
          );
        });

        it('Should revert error if health factor is broken', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);
          const tokenCollaterAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1');
          const amountDhcToMint = ethers.utils.parseEther('1800');

          const tx = await DHCEngine.depositCollateral(tokenCollaterAddress, collateralValue);
          await tx.wait();

          const accountInformation = await DHCEngine.getAccountInformation(deployer.address);
          const collateralValueInUsd = accountInformation.collateralValueInUsd;

          const expectedHealthFactor = await DHCEngine.calculateHealthFactor(
            amountDhcToMint,
            collateralValueInUsd
          );
          // console.log(`Expected health factor: ${expectedHealthFactor.toString()}`);

          await expect(DHCEngine.mintDhc(amountDhcToMint))
            .to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__BreaksHealthFactor')
            .withArgs(expectedHealthFactor);
        });

        it('Should revert on mint fail', async () => {
          const mockFailedMintFactory = await ethers.getContractFactory('MockFailedMint');
          const mockFailedMint = await mockFailedMintFactory.deploy();
          await mockFailedMint.deployed();

          const dhcEngineFactory = await ethers.getContractFactory('DHCEngine');
          const dhcEngine = await dhcEngineFactory.deploy(
            [weth.address],
            [ethUsdPriceFeed.address],
            mockFailedMint.address
          );
          await dhcEngine.deployed();

          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(dhcEngine.address, AMOUNT_TO_MINT);

          await mockFailedMint.transferOwnership(dhcEngine.address);

          const tokenCollaterAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1');

          const depositTx = await dhcEngine.depositCollateral(
            tokenCollaterAddress,
            collateralValue
          );
          await depositTx.wait();

          const amountDhcToMint = ethers.utils.parseEther('100');
          await expect(dhcEngine.mintDhc(amountDhcToMint)).to.be.revertedWithCustomError(
            dhcEngine,
            'DHCEngine__MintFailed'
          );
        });
      });

      describe('Deposit Collateral and mint DHC', () => {
        it('Should successfuly allow to Deposit and mint DHC', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollaterAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1'); // $2000 - 1 ETH
          const amountDhcToMint = ethers.utils.parseEther('900'); // $1200 coins

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollaterAddress,
            collateralValue,
            amountDhcToMint
          );

          const expectedBalance = amountDhcToMint;
          const actualBalance = await DHC.balanceOf(deployer.address);
          assert.equal(actualBalance.toString(), expectedBalance.toString());
        });

        it('Should revert error if breaks health factor', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollaterAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1');
          const amountDhcToMint = await DHCEngine.getUsdValue(
            weth.address,
            ethers.utils.parseEther('1')
          );

          const expectedHealthFactor = await DHCEngine.calculateHealthFactor(
            amountDhcToMint,
            amountDhcToMint
          );

          await expect(
            DHCEngine.depostitCollateralandMintDHC(
              tokenCollaterAddress,
              collateralValue,
              amountDhcToMint
            )
          )
            .to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__BreaksHealthFactor')
            .withArgs(expectedHealthFactor);
        });
      });

      describe('Burn DHC Tests', () => {
        it('Shoult revert if amount to burn is zero', async () => {
          const amountToBurn = 0;
          await expect(DHCEngine.burnDhc(amountToBurn)).to.be.revertedWithCustomError(
            DHCEngine,
            'DHCEngine__NeedsMoreThanZero'
          );
        });

        it('Should allow to burn some DHC tokens', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollaterAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1'); // $2000 - 1 ETH
          const amountDhcToMint = ethers.utils.parseEther('900'); // $1200 coins

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollaterAddress,
            collateralValue,
            amountDhcToMint
          );
          const userBalanceAfterMinting = await DHC.balanceOf(deployer.address);
          // console.log(userBalanceAfterMinting.toString());

          // BURNING DHC
          const amountToBurn = ethers.utils.parseEther('100');
          await DHC.approve(DHCEngine.address, amountToBurn);
          await DHCEngine.burnDhc(amountToBurn);

          const expectedUserBalance = userBalanceAfterMinting - amountToBurn;

          const updatedUserBalance = await DHC.balanceOf(deployer.address);

          assert.equal(updatedUserBalance.toString(), expectedUserBalance.toString());
        });

        it('Should revert error if we want to burn more than we have', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1'); // $2000 - 1 ETH
          const amountDhcToMint = ethers.utils.parseEther('900'); // $900 coins

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );
          // const userBalanceAfterMinting = await DHC.balanceOf(deployer.address);
          // console.log(userBalanceAfterMinting.toString());

          const amountToBurn = ethers.utils.parseEther('1100');
          await DHC.approve(DHCEngine.address, amountDhcToMint);
          await expect(DHCEngine.burnDhc(amountToBurn)).to.be.reverted;
        });

        it('Should reverts error if transfer failed', async () => {
          const failedTransferFromFactory = await ethers.getContractFactory(
            'MockFailedTransferFrom'
          );
          const failedTransferFrom = await failedTransferFromFactory.deploy();
          await failedTransferFrom.deployed();

          const dhcEngineFactory = await ethers.getContractFactory('DHCEngine');
          const dhcEngine = await dhcEngineFactory.deploy(
            [weth.address],
            [ethUsdPriceFeed.address],
            failedTransferFrom.address
          );
          await dhcEngine.deployed();
          await failedTransferFrom.transferOwnership(dhcEngine.address);

          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(dhcEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1'); // $2000 - 1 ETH
          const amountDhcToMint = ethers.utils.parseEther('100'); // $100 coins

          await dhcEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );

          // const burnAmount = ethers.utils.parseEther('50');
          const burnAmount = '50';
          await failedTransferFrom.approve(dhcEngine.address, burnAmount);

          await expect(dhcEngine.burnDhc(burnAmount)).to.be.revertedWithCustomError(
            dhcEngine,
            'DHCEngine__TransferFailed'
          );
        });
      });

      describe('Redeem Collateral Tests', () => {
        it('Should revert error if amount redeeming is 0', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('1'); // $2000
          const amountDhcToMint = ethers.utils.parseEther('900');

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );

          const amountToRedeem = 0;

          await expect(
            DHCEngine.redeemCollateral(tokenCollateralAddress, amountToRedeem)
          ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NeedsMoreThanZero');
        });
        it('Should allow user to successfully redeem collateral', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('2'); // $4000
          const amountDhcToMint = ethers.utils.parseEther('900');

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );

          const depositedAmount = await DHCEngine.getCollateralDepositedAmountOfUser(
            deployer.address,
            tokenCollateralAddress
          );
          // console.log(depositedAmount);

          const amountToRedeem = ethers.utils.parseEther('0.5');
          await DHCEngine.redeemCollateral(tokenCollateralAddress, amountToRedeem);

          const depositedAmountUpdated = await DHCEngine.getCollateralDepositedAmountOfUser(
            deployer.address,
            tokenCollateralAddress
          );
          const expectedDepositedAmount = ethers.utils.parseEther('1.5');
          assert.equal(depositedAmountUpdated.toString(), expectedDepositedAmount.toString());
        });
        it('Should revert error if user breaks health factor after redeeming collateral', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = await weth.address;
          const collateralValue = ethers.utils.parseEther('1');
          const amountDhcToMint = ethers.utils.parseEther('850');

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );
          const amountToRedeemInWei = ethers.utils.parseEther('302');
          const amountToRedeem = await DHCEngine.getTokenAmountFromUsd(
            weth.address,
            amountToRedeemInWei
          );
          const accountCollateralValue = await DHCEngine.getAccountCollateralValue(
            deployer.address
          );
          const userCollateralBalance = accountCollateralValue.sub(amountToRedeemInWei);
          // console.log(userCollateralBalance.toString()); // 1698 000000000000000000

          // const userCollateralBalanceInUsd = await DHCEngine.getUsdValue(
          //   weth.address,
          //   userCollateralBalance
          // );
          // console.log(`userCollateralBalanceInUsd: ${userCollateralBalanceInUsd}`);

          const expectedHealthFactor = await DHCEngine.calculateHealthFactor(
            amountDhcToMint,
            userCollateralBalance
          );
          // console.log(expectedHealthFactor.toString()); // 998823529411764705

          await expect(DHCEngine.redeemCollateral(weth.address, amountToRedeem))
            .to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__BreaksHealthFactor')
            .withArgs(expectedHealthFactor);
        });
        it('Should emit event when redeeming collateral is successful', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('2'); // $4000
          const amountDhcToMint = ethers.utils.parseEther('900');

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );

          const depositedAmount = await DHCEngine.getCollateralDepositedAmountOfUser(
            deployer.address,
            tokenCollateralAddress
          );
          // console.log(depositedAmount);

          const amountToRedeem = ethers.utils.parseEther('0.5');
          await expect(DHCEngine.redeemCollateral(tokenCollateralAddress, amountToRedeem))
            .to.emit(DHCEngine, 'CollateralRedeemed')
            .withArgs(deployer.address, deployer.address, tokenCollateralAddress, amountToRedeem);
        });

        it('Should revert when tranfer fails', async () => {
          const MockFailedTransferFactory = await ethers.getContractFactory('MockFailedTransfer');
          const mockFailedTransfer = await MockFailedTransferFactory.deploy();
          await mockFailedTransfer.deployed();

          const newDHCEngineFactory = await ethers.getContractFactory('DHCEngine');
          const newDHCEngine = await newDHCEngineFactory.deploy(
            [mockFailedTransfer.address],
            [ethUsdPriceFeed.address],
            mockFailedTransfer.address
          );
          await newDHCEngine.deployed();
          // ! ------------------------------------------------------------------------
          await mockFailedTransfer.mint(deployer.address, AMOUNT_TO_MINT);
          await mockFailedTransfer.approve(newDHCEngine.address, AMOUNT_TO_MINT);

          await mockFailedTransfer.transferOwnership(newDHCEngine.address);

          const tokenCollateralAddress = mockFailedTransfer.address;
          const collateralValue = ethers.utils.parseEther('2'); // $4000
          const amountDhcToMint = ethers.utils.parseEther('900');

          await newDHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );

          const amountToRedeem = ethers.utils.parseEther('0.01');

          await expect(
            newDHCEngine.redeemCollateral(tokenCollateralAddress, amountToRedeem)
          ).to.be.revertedWithCustomError(newDHCEngine, 'DHCEngine__TransferFailed');
        });
      });

      describe('Redeem Collateral For DHC Tests', () => {
        it('Reverts error if values are 0', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('2'); // $4000
          const amountDhcToMint = ethers.utils.parseEther('900');

          await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );

          const redeemCollateralValue = ethers.utils.parseEther('0.01');
          const redeemAmountDhc = ethers.utils.parseEther('100');

          await DHC.approve(DHCEngine.address, redeemAmountDhc);

          // if collateral is 0
          await expect(
            DHCEngine.redeemCollateralForDHC(tokenCollateralAddress, 0, redeemAmountDhc)
          ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NeedsMoreThanZero');
          // if dhc is 0
          await expect(
            DHCEngine.redeemCollateralForDHC(tokenCollateralAddress, redeemCollateralValue, 0)
          ).to.be.revertedWithCustomError(DHCEngine, 'DHCEngine__NeedsMoreThanZero');
        });
        it('Should allow to successfully redeem and burn DHC', async () => {
          await weth.mint(deployer.address, AMOUNT_TO_MINT);
          await weth.approve(DHCEngine.address, AMOUNT_TO_MINT);

          const tokenCollateralAddress = weth.address;
          const collateralValue = ethers.utils.parseEther('2'); // $4000
          const amountDhcToMint = ethers.utils.parseEther('900');

          const depositTx = await DHCEngine.depostitCollateralandMintDHC(
            tokenCollateralAddress,
            collateralValue,
            amountDhcToMint
          );
          await depositTx.wait();

          const redeemCollateralValue = ethers.utils.parseEther('0.01');
          const redeemAmountDhc = ethers.utils.parseEther('100');

          const approveTx = await DHC.approve(DHCEngine.address, redeemAmountDhc);
          await approveTx.wait();

          const redeemingTx = await DHCEngine.redeemCollateralForDHC(
            tokenCollateralAddress,
            redeemCollateralValue,
            redeemAmountDhc
          );

          await redeemingTx.wait();

          const accountInforamtion = await DHCEngine.getAccountInformation(deployer.address);
          const totalDhcMinted = accountInforamtion.totalDhcMinted;
          const collateralValueInUsd = accountInforamtion.collateralValueInUsd;

          const collateralValueInEth = collateralValue.sub(redeemCollateralValue);
          const expectedCollateralValueInUsd = await DHCEngine.getUsdValue(
            weth.address,
            collateralValueInEth
          );
          const expectedDhcAmount = amountDhcToMint.sub(redeemAmountDhc);
          assert.equal(totalDhcMinted.toString(), expectedDhcAmount.toString());
          assert.equal(collateralValueInUsd.toString(), expectedCollateralValueInUsd.toString());
        });
      });

      describe('Calculate Health Factor Tests', () => {
        it('Should return max int value if total minted is 0', async () => {
          const totalDhcMinted = 0;
          const collateralValueInUsd = ethers.utils.parseEther('2000');
          const expectedHealthFactor = UINT256_MAX;
          const userHealthFactor = await DHCEngine.calculateHealthFactor(
            totalDhcMinted,
            collateralValueInUsd
          );
          const readUserHealthFactor = await DHCEngine.getHealthFactor(deployer.address);
          assert.equal(userHealthFactor.toString(), expectedHealthFactor.toString());
          assert.equal(readUserHealthFactor.toString(), expectedHealthFactor.toString());
        });
        it('Should be able to get minimal health factor value', async () => {
          const minHealthFactor = await DHCEngine.getMinHealthFactor();
          assert.equal(minHealthFactor.toString(), MIN_HEALTH_FACTOR.toString());
        });
      });

      // TODO Liquidation tests
      // TODO Add mocks for Transfer Failed cases (transferFrom and transfer)
      // TODO Add mocks for failed mint cases
      // ? Reentrancy guard tests
    });
