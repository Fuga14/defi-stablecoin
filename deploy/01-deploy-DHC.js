const { network } = require('hardhat');
const { verify } = require('../helper-functions');
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require('../helper-hardhat-config');

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy, log } = deployments;
    const waitConfiramtions = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    const args = [];
    const decentralizedHryvnaCoin = await deploy('DecentralizedHryvnaCoin', {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitConfiramtions,
    });

    // Verify the contract
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log('Verigying contract...');
        await verify(decentralizedHryvnaCoin.address, args);
    }
    log('----------------------------------------------------------------');
};

module.exports.tags = ['all', 'dhc'];
