import sys
import io
import wave
import numpy as np
from piper import PiperVoice

def generate_audio_stream(text):
    try:
        voice = PiperVoice.load("/app/piper/en_GB-alan-medium.onnx")
        audio = voice.synthesize(text)
        
        # Convert audio to WAV format
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)  # mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(voice.config.sample_rate)
                wav_file.writeframes(audio.tobytes())
            
            wav_data = wav_io.getvalue()
        
        sys.stdout.buffer.write(wav_data)
        sys.stdout.buffer.flush()
    except Exception as e:
        print(f"Error generating audio: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    input_text = sys.stdin.read().strip()
    if input_text:
        generate_audio_stream(input_text)
    else:
        print("No input received", file=sys.stderr)
        sys.exit(1)