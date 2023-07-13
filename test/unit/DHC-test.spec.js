// const { assert, expect } = require('chai');
// const { network, deployments, ethers } = require('hardhat');
// const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

// !developmentChains.includes(network.name)
//   ? describe.skip
//   : describe('Decentralized Hryvna Coin Unit Tests', () => {
//       let DHC;
//       let DHCEngine;
//       let weth, wbtc;
//       let deployer, user1, user2;
//       let ethUsdPriceFeed, btcUsdPriceFeed;

//       beforeEach(async () => {
//         [deployer, user1, user2] = await ethers.getSigners();
//         await deployments.fixture(['all']);
//         weth = await ethers.getContractAt('ERC20Mock', networkConfig[31337].wethAddress);
//         DHC = await ethers.getContract('DecentralizedHryvnaCoin');
//         DHC = await DHC.connect(deployer);
//         DHCEngine = await ethers.getContract('DHCEngine');
//         DHCEngine = await DHCEngine.connect(deployer);
//         // DHC.transferOwnership(DHCEngine.address);
//         DHC.connect(DHCEngine).transferOwnership(deployer.address);
//         DHC.connect(deployer);

//         //   DHC.transferOwnership(DHCEngine.address);
//       });

//       it('Check for addresses', async () => {
//         console.log(`Address of deployer: ${deployer.address}`);
//         const owner = await DHC.owner();
//         console.log(`Owner of contract: ${owner}`);
//       });
//     });
