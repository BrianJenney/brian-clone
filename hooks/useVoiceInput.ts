'use client';

import { useState, useRef, useEffect } from 'react';

interface UseVoiceInputReturn {
	isListening: boolean;
	transcript: string;
	isSupported: boolean;
	error: string | null;
	startListening: () => void;
	stopListening: () => void;
	resetTranscript: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isSupported, setIsSupported] = useState(false);
	const recognitionRef = useRef<any>(null);

	useEffect(() => {
		// Check if Web Speech API is supported
		if (typeof window !== 'undefined') {
			const SpeechRecognition =
				(window as any).SpeechRecognition ||
				(window as any).webkitSpeechRecognition;
			setIsSupported(!!SpeechRecognition);

			if (SpeechRecognition) {
				const recognition = new SpeechRecognition();
				recognition.continuous = true;
				recognition.interimResults = true;
				recognition.lang = 'en-US';

				recognition.onresult = (event: any) => {
					let finalTranscript = '';
					let interimTranscript = '';

					for (let i = event.resultIndex; i < event.results.length; i++) {
						const transcript = event.results[i][0].transcript;
						if (event.results[i].isFinal) {
							finalTranscript += transcript + ' ';
						} else {
							interimTranscript += transcript;
						}
					}

					setTranscript((prev) => prev + finalTranscript + interimTranscript);
				};

				recognition.onerror = (event: any) => {
					console.error('Speech recognition error:', event.error);
					setError(`Voice input error: ${event.error}`);
					setIsListening(false);
				};

				recognition.onend = () => {
					setIsListening(false);
				};

				recognitionRef.current = recognition;
			}
		}

		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.stop();
			}
		};
	}, []);

	const startListening = () => {
		if (!recognitionRef.current) {
			setError('Voice input is not supported in your browser');
			return;
		}

		try {
			setError(null);
			setTranscript('');
			recognitionRef.current.start();
			setIsListening(true);
		} catch (err) {
			console.error('Error starting recognition:', err);
			setError('Failed to start voice input');
		}
	};

	const stopListening = () => {
		if (recognitionRef.current) {
			recognitionRef.current.stop();
			setIsListening(false);
		}
	};

	const resetTranscript = () => {
		setTranscript('');
	};

	return {
		isListening,
		transcript,
		isSupported,
		error,
		startListening,
		stopListening,
		resetTranscript,
	};
}
