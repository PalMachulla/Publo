// Quick test script to check API generation
const fetch = require('node-fetch');

async function testGenerate() {
  console.log('🧪 Testing /api/generate endpoint...\n');
  
  const response = await fetch('http://localhost:3002/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      system_prompt: 'You are a helpful assistant.',
      user_prompt: 'Say hello in 10 words or less.',
      max_tokens: 100,
      temperature: 0.7,
      top_p: 1,
    }),
  });

  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);
  
  const data = await response.json();
  console.log('\nResponse:', JSON.stringify(data, null, 2));
}

testGenerate().catch(console.error);

