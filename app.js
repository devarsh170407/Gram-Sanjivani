import { auth, db } from './firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// 1. Voice-to-Voice Logic
const btnVoice = document.getElementById('btn-voice');
let voiceState = { awaitingFollowUp: false, currentSymptom: null };

btnVoice.onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return alert("Browser not supported");

    const recognition = new Recognition();

    let preferredLang = localStorage.getItem('preferredLang') || 'en';
    if (preferredLang === 'hi') {
        recognition.lang = 'hi-IN';
    } else if (preferredLang === 'gu') {
        recognition.lang = 'gu-IN';
    } else {
        recognition.lang = 'en-IN';
    }

    recognition.onstart = () => {
        btnVoice.querySelector('span').innerText = "Listening...";
        btnVoice.style.boxShadow = "0 0 20px var(--primary-color)";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        if (voiceState.awaitingFollowUp) {
            handleFollowUpAnswer(transcript); // Function from your app.js
        } else {
            processInitialSymptom(transcript); // Function from your app.js
        }
    };

    recognition.onend = () => {
        btnVoice.querySelector('span').innerText = "Voice Chat";
        btnVoice.style.boxShadow = "none";
    };

    recognition.start();
};
async function processInitialSymptom(transcript) {
    const resIssue = document.getElementById('res-issue');
    const resRemedy = document.getElementById('res-remedy');
    const resWarning = document.getElementById('res-warning');
    const resultSection = document.getElementById('analysis-result');

    resultSection.classList.remove('hidden');
    resIssue.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analyzing your symptoms...`;
    resRemedy.innerText = "Please wait while our AI medical assistant generates a safe response.";
    resWarning.innerText = "";

    speak({
        en: "Analyzing your symptoms, please wait.",
        hi: "आपके लक्षणों का विश्लेषण किया जा रहा है, कृपया प्रतीक्षा करें।",
        gu: "તમારા લક્ષણોનું વિશ્લેષણ કરવામાં આવી રહ્યું છે, કૃપા કરીને રાહ જુઓ."
    });

    try {
        let preferredLang = localStorage.getItem('preferredLang') || 'en';
        let languageInstruction = "English";
        if (preferredLang === 'hi') languageInstruction = "Hindi (हिंदी)";
        if (preferredLang === 'gu') languageInstruction = "Gujarati (ગુજરાતી)";

        const prompt = `You are an expert AI medical assistant for the Gram Sanjivani app. 
The user said the following symptoms: "${transcript}".
Please provide a response IN THE ${languageInstruction} LANGUAGE ONLY.
Format your response as a valid JSON object with exactly three fields (no markdown formatting):
1. "remedy": A safe, general home remedy for this issue.
2. "ayurvedic": An Ayurvedic solution for this issue.
3. "voiceResponse": A short 1-2 sentence conversational reply combining the remedy and ayurvedic approach to be spoken aloud by the voice assistant.

Keep the answers concise and easy to understand for rural users. Return ONLY the JSON object.`;

        // Send request to our secure Vercel backend instead of Google directly
        const response = await fetch('/api/gemini', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to fetch from backend");
        }

        const aiText = data.candidates[0].content.parts[0].text;

        // Parse the JSON block from text
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        let parsedData;
        if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
        } else {
            parsedData = {
                remedy: aiText,
                ayurvedic: "No specific Ayurvedic solution found.",
                voiceResponse: aiText
            };
        }

        displayAndSpeakResult(parsedData);
    } catch (error) {
        console.error("AI Analysis Error:", error);
        resIssue.innerText = "Error analyzing symptoms";
        resRemedy.innerText = error.message;
        speak({
            en: "Sorry, there was an error processing your request.",
            hi: "क्षमा करें, आपके अनुरोध को प्रोसेस करने में कोई त्रुटि हुई।",
            gu: "માફ કરશો, તમારી વિનંતી પર પ્રક્રિયા કરવામાં ભૂલ હતી."
        });
    }
}

function displayAndSpeakResult(data) {
    resultSection.classList.remove('hidden');
    resIssue.innerHTML = `<i class="fas fa-comment-medical"></i> Voice Analysis Result`;
    resRemedy.innerHTML = `<strong>Home Remedy:</strong> ${data.remedy}<br><br><strong>Ayurvedic Solution:</strong> ${data.ayurvedic}`;
    resWarning.innerText = "Note: If symptoms persist, please consult a doctor.";
    speak(data.voiceResponse);

    if (auth.currentUser) {
        addDoc(collection(db, "diagnostics"), {
            userId: auth.currentUser.uid,
            type: "voice_analysis",
            result: data,
            timestamp: new Date()
        }).catch(e => console.error("Error saving voice diagnostic:", e));
    }
}

function speak(textObject) {
    window.speechSynthesis.cancel();

    let lang = localStorage.getItem('preferredLang') || 'en';
    let textToSpeak = typeof textObject === 'string' ? textObject : (textObject[lang] || textObject.en);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    let targetLang = 'en-US';
    if (lang === 'hi') targetLang = 'hi-IN';
    else if (lang === 'gu') targetLang = 'gu-IN';

    utterance.lang = targetLang;

    // Explicitly try to find local browser or Google-provided voices for the target language
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        // Priority 1: Exact Google language match (e.g. Google ગુજરાતી)
        let bestVoice = voices.find(v => v.lang === targetLang && v.name.includes('Google'));

        // Priority 2: Any voice matching the language code (e.g. gu-IN)
        if (!bestVoice) bestVoice = voices.find(v => v.lang.startsWith(lang));

        // Priority 3: If Gujarati is selected but NO Gujarati voice exists on this phone/PC, 
        // fall back to a Hindi voice so it at least attempts to speak the Gujarati script.
        if (!bestVoice && lang === 'gu') {
            bestVoice = voices.find(v => v.lang.startsWith('hi'));
        }

        if (bestVoice) {
            utterance.voice = bestVoice;
        }
    }

    // Bug workaround for long text in Chrome
    utterance.rate = 0.9;

    // Add an event listener to catch errors
    utterance.onerror = (e) => console.error("Speech Synthesis Error:", e);

    window.speechSynthesis.speak(utterance);
}

// Preload voices to ensure they are available when speak() is called
window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };







// 2. Camera Logic
const video = document.getElementById('camera-preview');
const cameraSection = document.getElementById('camera-section');

document.getElementById('btn-camera').onclick = async () => {
    cameraSection.classList.remove('hidden');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera access denied: " + err);
    }
};

// 3. Updated Upload & Analysis Logic
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload'); // Add this line
const resultSection = document.getElementById('analysis-result');
const resIssue = document.getElementById('res-issue');
const resRemedy = document.getElementById('res-remedy');
const resWarning = document.getElementById('res-warning');

btnUpload.onclick = () => {
    fileInput.click(); // This opens the window to select a file
};

fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Show the result card and a loading message
    resultSection.classList.remove('hidden');
    resIssue.innerText = "Analyzing Image...";
    resRemedy.innerText = "Scanning for symptoms and patterns...";
    resWarning.innerText = "";

    // 2. Simulate API Delay (Replace this with your fetch('/api/analyze') call)
    setTimeout(async () => {
        // Mock Analysis Data based on common skin/health issues
        const analysis = {
            issue: "Possible Contact Dermatitis",
            remedy: "Home Remedy: Apply a cold compress and aloe vera gel. Avoid harsh soaps.",
            ointment: "Suggested Ointment: Hydrocortisone cream (Consult a doctor before use).",
            warning: "Note: If swelling increases or you develop a fever, please use the Emergency button immediately."
        };

        // 3. Update the UI with the "Answer"
        resIssue.innerHTML = `<i class="fas fa-search-medical"></i> Analysis Result: ${analysis.issue}`;
        resRemedy.innerText = analysis.remedy;

        // Show ointment if your HTML has the element (it was in your previous file)
        const resOintment = document.getElementById('res-ointment');
        if (resOintment) resOintment.innerText = analysis.ointment;

        resWarning.innerText = analysis.warning;

        // 4. Voice Feedback (Optional: Speaks the result to the user)
        const voiceResponses = {
            en: `Analysis complete. We detected ${analysis.issue}. ${analysis.remedy}`,
            hi: `विश्लेषण पूर्ण हुआ। हमने संपर्क डर्मेटाइटिस का पता लगाया है। ठंडी सिकाई और एलोवेरा जेल लगाएं।`,
            gu: `વિશ્લેષણ પૂર્ણ થયું. અમે સંપર્ક ત્વચાકોપ શોધી કાઢ્યું છે. ઠંડી પટ્ટી અને કુંવારપાઠા નો ગર લગાવો.`
        };
        speak(voiceResponses);

        // Save to Firestore
        if (auth.currentUser) {
            try {
                await addDoc(collection(db, "diagnostics"), {
                    userId: auth.currentUser.uid,
                    type: "image_analysis",
                    result: analysis,
                    timestamp: new Date()
                });
            } catch (e) {
                console.error("Error saving diagnostic:", e);
            }
        }
    }, 2500);
};