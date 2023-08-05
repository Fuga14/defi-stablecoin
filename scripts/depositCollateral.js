const { ethers, network, getNamedAccounts } = require('hardhat');
// const { abi } = require('./weth-abi-sepolia');
const abi = require('./weth-abi-sepolia.json');

async function depositCollateral() {
  const { deployer } = await getNamedAccounts();
  console.log(deployer);
  const contractABI = abi;
  const contractAddress = '0xdd13e55209fd76afe204dbda4007c227904f0a81';
  const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wethContract = new ethers.Contract(contractAddress, contractABI, provider);
  const amountToApprove = ethers.utils.parseEther('0.001');
  const signer = await ethers.getSigner(deployer);
  const txApprove = await wethContract
    .connect(signer)
    .approve('0x092dc07A6e42888B1B8caB478CF7e897D5ab05e9', amountToApprove);
  await txApprove.wait();

  const dhcEngine = await ethers.getContract('DHCEngine');
  const txDeposit = await dhcEngine
    .connect(signer)
    .depositCollateral(contractAddress, amountToApprove);
  await txDeposit.wait();
}

depositCollateral()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
