export async function processOCRText(req, res) {
  const { ocrText } = req.body;

  if (!ocrText || typeof ocrText !== 'string') {
    return res.status(400).json({ error: 'ocrText is required and must be a string.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set in the backend .env file.');
    return res.status(500).json({ error: 'Server misconfiguration. Contact administrator.' });
  }

  const prompt = `
    Analyze the following raw OCR text extracted from an electricity bill.
    Your task is to:
    1. Ignore OCR mistakes, typos, or irrelevant text.
    2. Identify and extract the following fields for an energy analysis form:
       - consumerNumber (The consumer number/ID, extract as a string)
       - consumerName (The consumer's full name)
       - discom (The electricity distribution company name, e.g., MSEDCL, Torrent Power, etc.)
       - state (Name of the Indian state)
       - tariff (The tariff category or tariff code/name)
       - contractDemand (The contract demand in kW, convert/output as a numeric value, e.g. 50 or 0.5)
       - supplyVoltage (Either "HT" or "LT")
       - billingPeriod (The billing period, e.g. "Jan 2026")
       - unitsConsumed (The units consumed in kWh, e.g. "1500")
       - sanctionedLoad (The sanctioned load in kW, convert/output as a numeric value, e.g. 10 or 0.5)
       - energyCharges (The energy charges amount)
       - demandCharges (The demand charges amount)
       - fixedCharges (The fixed charges amount, if shown)
       - wheelingCharges (The wheeling charges amount, if shown)
       - electricityDuty (The electricity duty amount)
       - totalBill (The total bill amount)
       - totalLossPercentage (The total loss percentage, if shown)
       - miscellaneousCharges (The miscellaneous charges amount, if shown)

    You must return a valid JSON object containing exactly these keys. If a field cannot be found, set its value to an empty string "".

    Raw OCR Text:
    """
    ${ocrText}
    """
  `;

  const candidateModels = [
    process.env.GROQ_MODEL,
    'qwen/qwen3.6-27b',
    'groq/compound',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b'
  ].filter(Boolean);

  // Remove duplicates while keeping order
  const modelsToTry = [...new Set(candidateModels)];

  let lastErrorData = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that parses electricity bill OCR text into structured JSON. Always output valid JSON only without markdown formatting blocks.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let resultText = data.choices[0]?.message?.content || '';
        
        // 1. Strip <think>...</think> tags if model produces reasoning blocks
        resultText = resultText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 2. Extract substring between first '{' and last '}'
        const firstBrace = resultText.indexOf('{');
        const lastBrace = resultText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonString = resultText.substring(firstBrace, lastBrace + 1);
          const parsedJSON = JSON.parse(jsonString);
          return res.json(parsedJSON);
        }
      }

      const errorData = await response.json();
      lastErrorData = errorData;
      console.warn(`Groq API error with model ${model}:`, errorData.error?.message || errorData);

      // If model not found or invalid request, continue loop to try next model
      if (errorData.error?.code === 'model_not_found' || errorData.error?.type === 'invalid_request_error') {
        continue;
      } else {
        // Break early for auth or credit issues
        break;
      }
    } catch (err) {
      console.error(`Fetch exception with model ${model}:`, err.message);
    }
  }

  return res.status(502).json({
    error: lastErrorData?.error?.message || 'Failed to communicate with AI API across available models.',
  });
}
