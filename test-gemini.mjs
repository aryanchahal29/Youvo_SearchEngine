import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = "AQ.Ab8RN6JUJjUEbbiEeIx8XIMBzsSU_K2BKssjBftyliOuOndlHA";
const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
  const model = genAI.getGenerativeModel({ model: modelName });
  try {
    const result = await model.generateContent("hello");
    console.log(`Success for ${modelName}`);
  } catch (e) {
    console.error(`Failed for ${modelName}: ${e.message}`);
  }
}

async function run() {
  await testModel("gemini-1.5-flash-latest");
  await testModel("gemini-1.5-pro-latest");
  await testModel("gemini-pro");
  await testModel("gemini-1.5-flash-8b");
}
run();
