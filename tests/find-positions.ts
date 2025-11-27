import { Connection, PublicKey } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';

async function main() {
  const conn = new Connection('https://api.devnet.solana.com');
  const dlmm = await DLMM.create(conn, new PublicKey('9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1'));
  const owner = new PublicKey('ANTUuoq2VKJ8341yxFHuepQ9fh7cDnGHZtM8kMQm7NjE');
  
  const positions = await dlmm.getPositionsByOwner(owner);
  console.log(`Found ${positions.length} positions:\n`);
  
  positions.forEach((p, i) => {
    console.log(`Position ${i+1}: ${p.publicKey.toString()}`);
  });
}

main().catch(console.error);
