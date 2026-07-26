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

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that parses electricity bill OCR text into structured JSON. Always output valid JSON only without markdown formatting blocks.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API error:', errorData);
      return res.status(502).json({
        error: errorData.error?.message || 'Failed to communicate with AI API.',
      });
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    const parsedJSON = JSON.parse(resultText);

    return res.json(parsedJSON);
  } catch (error) {
    console.error('AI Processing Error:', error);
    return res.status(500).json({
      error: 'Failed to extract data from the text: ' + error.message,
    });
  }
}
