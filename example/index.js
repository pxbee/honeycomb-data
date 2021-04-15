const wallet = require('./../queries/wallet');

const main = async () => {
	//array of tokens contracts to call
	const tokens = ['0x3050e20fabe19f8576865811c9f28e85b96fa4f9'];
	const tokenBalances = await wallet.simplyTokenBalances({
		user_address: '0x00',
		network: 'rinkeby',
		tokens: tokens,
	});
	console.log(tokenBalances);
};
main();
