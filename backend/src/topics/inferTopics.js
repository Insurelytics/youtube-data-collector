

// use NLP to add 0-5 hashtags to the video transcription
function inferTopicsFromTranscription(transcription, title, description) { 
    // ask if image is needed
    const isEnoughContext = true; // in the future, we can ask the AI if it needs the thumbnail in order to infer topics (useful for videos with only music for example)
    if (isEnoughContext) {
        // use NLP to add 0-5 hashtags to the video transcription
        const hashtags = transcription.match(/#[a-zA-Z0-9_]+/g) || [];
        return hashtags.slice(0, 5);
    }
    return [];
}