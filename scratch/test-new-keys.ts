import { generateMachineId } from '../src/lib/machine-id';
import { generateActivationKey } from '../src/license/validator';

async function run() {
  const mid = await generateMachineId();
  console.log('Machine ID:', mid);
  if (mid) {
    const key = generateActivationKey(mid);
    console.log('Activation Key:', key);
  }
}

run();
