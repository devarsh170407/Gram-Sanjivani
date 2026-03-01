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

        let errorMessage = error.message;

        // Handle Gemini Rate Limit (Quota Exceeded) gracefully
        if (errorMessage.includes("Quota") || errorMessage.includes("429") || errorMessage.includes("rate limit")) {
            resRemedy.innerText = "The AI service is receiving too many requests. Please wait 1 minute and try again.";
            speak({
                en: "The AI assistant is currently busy. Please wait a moment and try again.",
                hi: "AI सहायक अभी व्यस्त है। कृपया कुछ देर प्रतीक्षा करें और फिर प्रयास करें।",
                gu: "AI સહાયક અત્યારે વ્યસ્ત છે. કૃપા કરીને થોડીવાર રાહ જુઓ અને ફરી પ્રયાસ કરો."
            });
        } else {
            resRemedy.innerText = errorMessage;
            speak({
                en: "Sorry, there was an error processing your request.",
                hi: "क्षमा करें, आपके अनुरोध को प्रोसेस करने में कोई त्रुटि हुई।",
                gu: "માફ કરશો, તમારી વિનંતી પર પ્રક્રિયા કરવામાં ભૂલ હતી."
            });
        }
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
const btnSwitchCamera = document.getElementById('btn-switch-camera');
const btnCapture = document.getElementById('btn-capture');
const photoCanvas = document.getElementById('photo-canvas');
let stream = null;
let useFrontCamera = false;

async function startCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    const constraints = {
        video: {
            facingMode: useFrontCamera ? "user" : "environment"
        }
    };
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
    } catch (err) {
        alert("Camera access denied: " + err);
    }
}

document.getElementById('btn-camera').onclick = async () => {
    cameraSection.classList.remove('hidden');
    await startCamera();
};

if (btnSwitchCamera) {
    btnSwitchCamera.onclick = async () => {
        useFrontCamera = !useFrontCamera;
        await startCamera();
    };
}

if (btnCapture) {
    btnCapture.onclick = () => {
        if (!stream) return;
        photoCanvas.width = video.videoWidth || 640;
        photoCanvas.height = video.videoHeight || 480;
        photoCanvas.getContext('2d').drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);

        photoCanvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.files = dataTransfer.files;
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }

            // Hide camera
            cameraSection.classList.add('hidden');
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        }, 'image/jpeg');
    };
}

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
    resIssue.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analyzing Image...`;
    resRemedy.innerText = "Scanning for symptoms and patterns...";
    resWarning.innerText = "Please wait while our AI medical assistant generates a safe response.";

    // Read the file and convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1];
        const mimeType = file.type;

        try {
            let preferredLang = localStorage.getItem('preferredLang') || 'en';
            let languageInstruction = "English";
            if (preferredLang === 'hi') languageInstruction = "Hindi (हिंदी)";
            if (preferredLang === 'gu') languageInstruction = "Gujarati (ગુજરાતી)";

            const prompt = `You are an expert AI medical assistant for the Gram Sanjivani app.
Analyze this image and identify the probable skin condition, health issue, or injury. 
Please provide a response IN THE ${languageInstruction} LANGUAGE ONLY.
Format your response as a valid JSON object with exactly four fields (no markdown formatting):
1. "issue": A short title of the probable issue discovered.
2. "remedy": A safe, general home remedy for this issue.
3. "ointment": A suggested over-the-counter medical ointment or solution. State that they should consult a doctor.
4. "warning": Any severe symptoms to look out for that would require using the Emergency button.

Keep the answers concise and easy to understand for rural users. Return ONLY the JSON object.`;

            const response = await fetch('/api/gemini', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompt, image: base64String, mimeType: mimeType })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch from backend");
            }

            const aiText = data.candidates[0].content.parts[0].text;

            // Parse the JSON block from text
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            let analysis;
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Unable to parse AI response");
            }

            // 3. Update the UI with the "Answer"
            resIssue.innerHTML = `<i class="fas fa-search-medical"></i> Analysis Result: ${analysis.issue}`;
            resRemedy.innerHTML = `<strong>Home Remedy:</strong><br>${analysis.remedy}`;

            const resOintment = document.getElementById('res-ointment');
            if (resOintment) resOintment.innerHTML = `<strong>Suggested Ointment:</strong><br>${analysis.ointment}`;

            resWarning.innerText = `Note: ${analysis.warning}`;

            // 4. Voice Feedback (Optional: Speaks the result to the user)
            let speechLang = 'en';
            if (preferredLang === 'hi') speechLang = 'hi';
            if (preferredLang === 'gu') speechLang = 'gu';

            const voiceResponses = {
                en: `Analysis complete. We detected ${analysis.issue}. ${analysis.remedy}`,
                hi: `विश्लेषण पूर्ण हुआ। हमने ${analysis.issue} का पता लगाया है। ${analysis.remedy}`,
                gu: `વિશ્લેષણ પૂર્ણ થયું. અમે ${analysis.issue} શોધી કાઢ્યું છે. ${analysis.remedy}`
            };

            let textToSpeak = voiceResponses[speechLang] || voiceResponses['en'];
            speak(textToSpeak);

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
        } catch (error) {
            console.error("Image Analysis Error:", error);
            resIssue.innerText = "Error analyzing image";

            let errorMessage = error.message;

            if (errorMessage.includes("Quota") || errorMessage.includes("429") || errorMessage.includes("rate limit")) {
                resRemedy.innerText = "The AI service is receiving too many requests. Please wait 1 minute and try again.";
                speak({
                    en: "The AI assistant is currently busy. Please wait a moment and try again.",
                    hi: "AI सहायक अभी व्यस्त है। कृपया कुछ देर प्रतीक्षा करें और फिर प्रयास करें।",
                    gu: "AI સહાયક અત્યારે વ્યસ્ત છે. કૃપા કરીને થોડીવાર રાહ જુઓ અને ફરી પ્રયાસ કરો."
                });
            } else {
                resRemedy.innerText = errorMessage;
                speak({
                    en: "Sorry, there was an error processing your image.",
                    hi: "क्षमा करें, आपकी छवि को प्रोसेस करने में कोई त्रुटि हुई।",
                    gu: "માફ કરશો, તમારી છબી પર પ્રક્રિયા કરવામાં ભૂલ હતી."
                });
            }
        }
    };
    reader.readAsDataURL(file);
};