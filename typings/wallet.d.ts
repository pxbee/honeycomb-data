type TokenBalances = {
    balance: number;
    name: string;
    address: string;
    symbol: string;
    logoURI: string;
    priceUsd: number;
    valueUsd: number;
}

export function tokenBalances({ user_address }: {
    user_address: string;
}): Promise<TokenBalances>;
