const wallet = require('./../queries/wallet');

const main = async () => {
	//array of tokens contracts to call
	const tokens = ['0x3050e20fabe19f8576865811c9f28e85b96fa4f9'];
	const tokenBalances = await wallet.simplyTokenBalances({
		user_address: '0x3816CC15C628c1647EB39e6B3C3c02ee9B770741',
		network: 'rinkeby',
		tokens: tokens,
	});
	console.log(tokenBalances);
};
main();
