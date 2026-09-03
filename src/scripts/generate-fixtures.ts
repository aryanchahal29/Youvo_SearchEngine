import * as fs from 'fs';
import * as path from 'path';

const queriesPath = path.join(process.cwd(), 'beta_queries_beta01.json');
const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));

const fixtures: Record<string, any> = {};

for (const q of queries) {
  let intentType = 'find_tool';
  let targetEntity = undefined;
  
  // Custom logic for specific tests
  let llmResponses: any[] = [];
  let tavilyResponses: any[] = [];

  const text = q.query.toLowerCase();

  // A. CRM software for small business
  if (text.includes('crm software for small business')) {
    tavilyResponses = [
      { title: "Best CRM Software", url: "https://sbdc.org/crm", content: "Sbdc list of CRMs." },
      { title: "Salesforce CRM", url: "https://salesforce.com", content: "Industry leading CRM." }
    ];
    llmResponses = [
      { name: "Sbdc", url: "https://sbdc.org/crm", description: "List of CRMs" },
      { name: "Salesforce", url: "https://salesforce.com", description: "CRM software for small business" }
    ];
  }
  // B. Free screen recorder
  else if (text.includes('completely free screen recorder for windows') || text.includes('free screen recorder')) {
    tavilyResponses = [
      { title: "Screen Recorder Synonyms", url: "https://www.thesaurus.com/browse/screen-recorder", content: "Synonyms for screen recorder" },
      { title: "OBS Studio", url: "https://obsproject.com", content: "Free and open source screen recorder" }
    ];
    llmResponses = [
      { name: "Thesaurus", url: "https://www.thesaurus.com/browse/screen-recorder", description: "Synonyms" },
      { name: "OBS Studio", url: "https://obsproject.com", description: "completely free screen recorder for windows" }
    ];
  }
  // C. Pictory specific-tool query
  else if (text.includes('pictory ai support 4k')) {
    intentType = 'specific_tool';
    targetEntity = 'Pictory';
    llmResponses = [
      { name: "Pictory AI", url: "https://pictory.ai", description: "Pictory AI video generator. Has free plan but 4k is paid only." }
    ];
    tavilyResponses = [
      { title: "Pictory AI", url: "https://pictory.ai", content: "Pictory AI video generator." }
    ];
  }
  // D. General question
  else if (text.includes('difference between crm and erp') || text.includes('chatgpt plus $20')) {
    intentType = 'general_question';
  }
  // E. Nonexistent tool
  else if (text.includes('xyzfakishtoolthatdoesnotexist123')) {
    llmResponses = [];
    tavilyResponses = [];
  }
  // Generic - populate with some noise to test filtering/duplicate removal
  else {
    llmResponses = [
      { name: "Generic Tool", url: "https://generic-tool.com", description: "Does what you need. free plan available." },
      { name: "Awesome List", url: "https://github.com/awesome-list", description: "List of tools" },
      { name: "TechCrunch Article", url: "https://techcrunch.com/article/123", description: "News about the tool" },
      { name: "Generic Tool", url: "https://generic-tool.com", description: "Duplicate. Does what you need." },
      { name: "Tool Without URL", url: "", description: "This has no URL" }
    ];
    tavilyResponses = [
      { title: "Generic Tool", url: "https://generic-tool.com", content: "Does what you need." }
    ];
  }

  fixtures[q.id] = {
    query_id: q.id,
    query: q.query,
    intent: { type: intentType, confidence: 0.9 },
    target_entity: targetEntity,
    llm_responses: {
      'gemini:proj-gemini-project-1': llmResponses,
      'groq:default-1': llmResponses,
      'gemini:flash-proj-gemini-project-1': llmResponses
    },
    tavily_responses: tavilyResponses
  };
}

const outDir = path.join(process.cwd(), 'src/tests/fixtures');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(path.join(outDir, 'controlled_eval_fixtures.json'), JSON.stringify(fixtures, null, 2));
console.log('Fixtures generated successfully.');
