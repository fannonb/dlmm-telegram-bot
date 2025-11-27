// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import chalk from 'chalk';

async function debugAPIResponse() {
  const poolAddress = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';

  console.log(chalk.blue.bold('\n🔍 DEBUGGING API RESPONSE\n'));
  console.log(`Pool Address: ${poolAddress}\n`);

  try {
    console.log(chalk.yellow('Fetching raw API response...\n'));
    
    const response = await axios.get(
      `https://dlmm-api.meteora.ag/pair/${poolAddress}`
    );

    console.log(chalk.green('✅ API Response received\n'));
    console.log(chalk.blue.bold('Full Response Object:\n'));
    console.log(JSON.stringify(response.data, null, 2));

    console.log(chalk.blue.bold('\n\nKey Fields Analysis:\n'));
    const data = response.data;
    
    console.log(chalk.yellow('Field Values:'));
    console.log(`  feeBps: ${data.feeBps} (type: ${typeof data.feeBps})`);
    console.log(`  base_fee_bps: ${data.base_fee_bps} (type: ${typeof data.base_fee_bps})`);
    console.log(`  tvl: ${data.tvl} (type: ${typeof data.tvl})`);
    console.log(`  volume24h: ${data.volume_24h} (type: ${typeof data.volume_24h})`);
    console.log(`  apr: ${data.apr} (type: ${typeof data.apr})`);
    console.log(`  bin_step: ${data.bin_step} (type: ${typeof data.bin_step})`);
    console.log(`  active_id: ${data.active_id} (type: ${typeof data.active_id})`);

    console.log(chalk.yellow('\n\nAll available fields:'));
    Object.keys(data).forEach(key => {
      console.log(`  • ${key}: ${typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]}`);
    });

  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error}\n`));
  }
}

debugAPIResponse().catch(console.error);
