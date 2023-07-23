// const { assert, expect } = require('chai');
// const { network, deployments, ethers } = require('hardhat');
// const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

// !developmentChains.includes(network.name)
//   ? describe.skip
//   : describe('Decentralized Hryvna Coin Unit Tests', () => {
//       let dhc;
//       let deployer, user1;

//       beforeEach(async () => {
//         [deployer, user1] = await ethers.getSigners();
//         const DHCFactory = await ethers.getContractFactory('DecentralizedHryvnaCoin');
//         const dhc = await DHCFactory.deploy();
//         await dhc.deployed();
//       });
//       // Ownable: caller is not the owner
//       describe('Burn function TESTS', () => {
//         it('Should revert if caller is not the owner', async () => {
//           const amount = '100';
//           await expect(dhc.connect(user1).burn(amount)).to.be.reverted(
//             'Ownable: caller is not the owner'
//           );
//         });
//       });
//     });
