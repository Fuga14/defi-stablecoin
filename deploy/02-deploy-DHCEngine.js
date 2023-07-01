const { network, ethers } = require('hardhat');
const { verify } = require('../helper-functions');
const {
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    networkConfig,
} = require('../helper-hardhat-config');

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitConfiramtions = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    const ethUsdPriceFeedAddress = networkConfig[chainId]['ethUsdPriceFeed'];
    const btcUsdPriceFeed = networkConfig[chainId]['btcUsdPriceFeed'];
    const wethAddress = networkConfig[chainId]['wethAddress'];
    const wbtcAddress = networkConfig[chainId]['wbtcAddress'];

    const dhc = await ethers.getContract('DecentralizedHryvnaCoin');

    const tokenAddresses = [wethAddress, wbtcAddress];
    const priceFeedAddresses = [ethUsdPriceFeedAddress, btcUsdPriceFeed];
    const args = [tokenAddresses, priceFeedAddresses, dhc.address];

    const dhcEngine = await deploy('DHCEngine', {
        from: deployer,
        log: true,
        args: args,
        waitConfirmations: waitConfiramtions,
    });

    dhc.transferOwnership(dhcEngine.address);

    // Verify the contract
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log('Verigying contract...');
        await verify(dhcEngine.address, args);
    }
    log('----------------------------------------------------------------');
};

module.exports.tags = ['all', 'dhcengine'];
