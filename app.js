import { auth, db } from './firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// app.js logic for Voice, Camera, and Upload

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
function processInitialSymptom(transcript) {
    const medicalDatabase = {
        headache: {
            keywords: ['headache', 'migraine', 'head pain', 'headpain', 'सिरदर्द', 'માથાનો દુખાવો'],
            remedy: "Apply a cold compress to your forehead and rest in a dark room.",
            ayurvedic: "Massage your temples with warm Brahmi oil or peppermint oil.",
            voiceResponse: {
                en: "It sounds like you have a headache. For a home remedy, apply a cold compress. In Ayurveda, Brahmi oil massage is very effective.",
                hi: "ऐसा लगता है कि आपको सिरदर्द है। घरेलू उपचार के लिए, ठंडी सिकाई करें। आयुर्वेद में, ब्राह्मी तेल की मालिश बहुत प्रभावी है।",
                gu: "લાગે છે કે તમને માથાનો દુખાવો છે. ઘરેલું ઉપચાર માટે, ઠંડી પટ્ટી લગાવો. આયુર્વેદમાં, બ્રાહ્મી તેલની માલિશ ખૂબ અસરકારક છે."
            }
        },
        stomach: {
            keywords: ['stomachache', 'pain in stomach', 'diarrhea', 'stomach pain', 'पेट दर्द', 'પેટમાં દુખાવો'],
            remedy: "Drink ginger tea and stay hydrated with electrolytes.",
            ayurvedic: "Take a teaspoon of Ajwain with a pinch of black salt and warm water.",
            voiceResponse: {
                en: "For stomach pain or diarrhea, ginger tea is a great home remedy. The Ayurvedic solution is taking Ajwain with warm water.",
                hi: "पेट दर्द या दस्त के लिए अदरक की चाय एक बढ़िया घरेलू उपाय है। आयुर्वेदिक समाधान अजवाइन को गर्म पानी के साथ लेना है।",
                gu: "પેટના દુખાવા માટે આદુવાળી ચા એક સારો ઉપાય છે. આયુર્વેદિક ઉપાય મુજબ ગરમ પાણી સાથે અજમો લેવો જોઈએ."
            }
        },
        itch: {
            keywords: ['itch in legs', 'smell in legs', 'itching', 'खुजली', 'ખંજવાળ'],
            remedy: "Wash your legs with mild soap and apply coconut oil or aloe vera.",
            ayurvedic: "Apply a paste of Neem leaves or use Turmeric mixed with honey on the affected area.",
            voiceResponse: {
                en: "For leg itching or smell, use coconut oil as a home remedy. In Ayurveda, Neem paste is highly recommended.",
                hi: "पैरों में खुजली या गंध के लिए, नारियल के तेल का उपयोग करें। आयुर्वेद में, नीम के पेस्ट की अनुशंसा की जाती है।",
                gu: "પગમાં ખંજવાળ માટે, ઘરેલુ ઉપચાર તરીકે નાળિયેર તેલનો ઉપયોગ કરો. આયુર્વેદમાં લીમડાની પેસ્ટનો ઉપયોગ ખૂબ જ ફાયદાકારક છે."
            }
        }
    };

    let found = false;
    for (let category in medicalDatabase) {
        const item = medicalDatabase[category];
        if (item.keywords.some(keyword => transcript.includes(keyword))) {
            displayAndSpeakResult(item);
            found = true;
            break;
        }
    }

    if (!found) {
        const fallbackObj = {
            en: "I'm sorry, I didn't catch that. Please mention if you have a headache, stomach pain, or itching.",
            hi: "मुझे खेद है, मुझे समझ नहीं आया। कृपया बताएं कि क्या आपको सिरदर्द, पेट में दर्द या खुजली है।",
            gu: "માફ કરશો, મને સમજાયું નહિ. કૃપા કરીને કહો કે શું તમને માથાનો દુખાવો, પેટનો દુખાવો અથવા ખંજવાળ છે."
        };
        const preferredLang = localStorage.getItem('preferredLang') || 'en';
        const fallbackText = fallbackObj[preferredLang];
        resIssue.innerText = "Symptom not recognized";
        resRemedy.innerText = fallbackText;
        speak(fallbackObj);
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
    if (lang === 'hi') {
        utterance.lang = 'hi-IN';
    } else if (lang === 'gu') {
        utterance.lang = 'gu-IN';
    } else {
        utterance.lang = 'en-IN';
    }
    window.speechSynthesis.speak(utterance);
}







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