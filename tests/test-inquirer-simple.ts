// Test inquirer compatibility
import inquirer from 'inquirer';
import chalk from 'chalk';

async function testInquirer() {
  console.log(chalk.blue('🧪 Testing Inquirer Compatibility...\n'));
  
  try {
    console.log('Testing simple list prompt...');
    
    const answer1 = await inquirer.prompt({
      type: 'list',
      name: 'test',
      message: 'Select a test option:',
      choices: ['Option 1', 'Option 2', 'Option 3', 'Exit Test']
    });
    
    console.log(chalk.green(`✅ You selected: ${answer1.test}\n`));
    
    if (answer1.test === 'Exit Test') {
      console.log(chalk.yellow('Test completed by user selection.'));
      return;
    }
    
    console.log('Testing input prompt...');
    const answer2 = await inquirer.prompt({
      type: 'input',
      name: 'name',
      message: 'Enter your name:',
      default: 'Test User'
    });
    
    console.log(chalk.green(`✅ Hello, ${answer2.name}!\n`));
    
    console.log('Testing confirm prompt...');
    const answer3 = await inquirer.prompt({
      type: 'confirm',
      name: 'continue',
      message: 'Continue with more tests?',
      default: true
    });
    
    if (answer3.continue) {
      console.log(chalk.green('✅ Confirmation prompt works!'));
    } else {
      console.log(chalk.yellow('User chose not to continue.'));
    }
    
    console.log(chalk.green.bold('\n🎉 ALL INQUIRER TESTS PASSED!'));
    console.log(chalk.blue('Inquirer is working correctly with this version.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Inquirer test failed:'), error);
    console.log(chalk.yellow('\nTrying alternative approach...'));
    
    // Fallback test
    try {
      const fallbackAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'fallback',
        message: 'Fallback test - select option:',
        choices: [
          { name: 'Test 1', value: 'test1' },
          { name: 'Test 2', value: 'test2' },
          { name: 'Exit', value: 'exit' }
        ]
      }]);
      
      console.log(chalk.green('✅ Fallback format works!'), fallbackAnswer.fallback);
    } catch (fallbackError) {
      console.error(chalk.red('❌ Both formats failed:'), fallbackError);
    }
  }
}

testInquirer().catch(console.error);
