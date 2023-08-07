const { ethers, network, getNamedAccounts } = require('hardhat');

async function mintDhc() {
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  const dhcEngine = await ethers.getContract('DHCEngine');
  const amountToMint = ethers.utils.parseEther('1');

  const txMint = await dhcEngine.connect(signer).mintDhc(amountToMint);
  await txMint.wait();
}

mintDhc()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
