// app.js logic for Voice, Camera, and Upload

// 1. Voice-to-Voice Logic
const btnVoice = document.getElementById('btn-voice');
let voiceState = { awaitingFollowUp: false, currentSymptom: null };

btnVoice.onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return alert("Browser not supported");

    const recognition = new Recognition();
    recognition.lang = 'en-IN'; // Set to Indian English for better rural accent support

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
            keywords: ['headache', 'migraine', 'head pain', 'headpain'],
            remedy: "Apply a cold compress to your forehead and rest in a dark room.",
            ayurvedic: "Massage your temples with warm Brahmi oil or peppermint oil.",
            voiceResponse: "It sounds like you have a headache. For a home remedy, apply a cold compress. In Ayurveda, Brahmi oil massage is very effective."
        },
        stomach: {
            keywords: ['stomachache', 'pain in stomach', 'diarrhea', 'stomach pain'],
            remedy: "Drink ginger tea and stay hydrated with electrolytes.",
            ayurvedic: "Take a teaspoon of Ajwain with a pinch of black salt and warm water.",
            voiceResponse: "For stomach pain or diarrhea, ginger tea is a great home remedy. The Ayurvedic solution is taking Ajwain with warm water."
        },
        itch: {
            keywords: ['itch in legs', 'smell in legs', 'itching'],
            remedy: "Wash your legs with mild soap and apply coconut oil or aloe vera.",
            ayurvedic: "Apply a paste of Neem leaves or use Turmeric mixed with honey on the affected area.",
            voiceResponse: "For leg itching or smell, use coconut oil as a home remedy. In Ayurveda, Neem paste is highly recommended."
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
        const fallback = "I'm sorry, I didn't catch that. Please mention if you have a headache, stomach pain, or itching legs.";
        resIssue.innerText = "Symptom not recognized";
        resRemedy.innerText = fallback;
        speak(fallback);
    }
}

function displayAndSpeakResult(data) {
    resultSection.classList.remove('hidden');
    resIssue.innerHTML = `<i class="fas fa-comment-medical"></i> Voice Analysis Result`;
    resRemedy.innerHTML = `<strong>Home Remedy:</strong> ${data.remedy}<br><br><strong>Ayurvedic Solution:</strong> ${data.ayurvedic}`;
    resWarning.innerText = "Note: If symptoms persist, please consult a doctor.";
    speak(data.voiceResponse);
}

function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
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
    setTimeout(() => {
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
        speak(`Analysis complete. We detected ${analysis.issue}. ${analysis.remedy}`);
    }, 2500); 
};