const { network } = require('hardhat');
const {
    developmentChains,
    DECIMALS,
    ETH_USD_PRICE,
    BTC_USD_PRICE,
} = require('../helper-hardhat-config');

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    // If we are on a local development network, we need to deploy mocks!
    let wethMock, wbtcMock, ethUsdPriceFeed, btcUsdPriceFeed;
    log(`Deployer: ${deployer}`);

    if (developmentChains.includes(network.name)) {
        log('Local network detected! Deploying mocks...');

        log('Deploying ethUsdPriceFeed mock...');
        ethUsdPriceFeed = await deploy('MockV3Aggregator', {
            contract: 'MockV3Aggregator',
            from: deployer,
            log: true,
            args: [DECIMALS, ETH_USD_PRICE],
        });

        log('Deploying weth mock...');
        wethMock = await deploy('ERC20Mock', {
            contract: 'ERC20Mock',
            from: deployer,
            log: true,
            args: ['WETH', 'WETH', deployer, 1000e8],
        });

        log('Deploying btcUsdPriceFeed mock...');
        btcUsdPriceFeed = await deploy('MockV3Aggregator', {
            contract: 'MockV3Aggregator',
            from: deployer,
            log: true,
            args: [DECIMALS, BTC_USD_PRICE],
        });

        log('Deploying wbtc mock...');
        wbtcMock = await deploy('ERC20Mock', {
            contract: 'ERC20Mock',
            from: deployer,
            log: true,
            args: ['WBTC', 'WBTC', deployer, 1000e8],
        });

        log('Mocks Deployed!');
        log('------------------------------------------------');
        // log(wbtcMock.address);
        // log(wethMock.address);
        // log(btcUsdPriceFeed.address);
        // log(ethUsdPriceFeed.address);
    }
};

module.exports.tags = ['all', 'mocks'];
