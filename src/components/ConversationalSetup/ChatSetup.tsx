import { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { EventConfig } from '../../types';
import { Loader2 } from 'lucide-react';
import { geocodeUSAddress, createRadiusBounds } from '../../lib/geocoding';
import { LatLng } from 'leaflet';

interface ChatSetupProps {
  onComplete: (config: EventConfig) => Promise<void>;
  hasAreaSelected: boolean;
  onMapCenterChange: (center: LatLng, zoom: number) => void;
  onAutoSelectArea: (center: LatLng, radiusMeters: number) => void;
}

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

interface QuickReply {
  label: string;
  value: any;
  description?: string;
}

type Step = 'welcome' | 'areaChoice' | 'address' | 'volunteers' | 'groupSize' | 'cars' | 'doors' | 'drawPrompt' | 'complete';

const PRESET_GROUP_SIZES: QuickReply[] = [
  { label: 'Solo (1)', value: 1 },
  { label: 'Pairs (2)', value: 2 },
  { label: 'Groups of 3', value: 3 },
];

const CAR_AVAILABILITY: QuickReply[] = [
  { label: '🚗 All have cars', value: 'all', description: 'Can spread packets out' },
  { label: '🚗 Some have cars', value: 'some', description: 'Mix of driving & walking' },
  { label: '🚶 None have cars', value: 'none', description: 'Walking distance only' },
];

const PRESET_DOOR_COUNTS: QuickReply[] = [
  { label: '30 doors', value: 30, description: 'Quick (30-45 min)' },
  { label: '50 doors', value: 50, description: 'Standard (1 hour)' },
  { label: '75 doors', value: 75, description: 'Long (1.5 hours)' },
];

export function ChatSetup({ onComplete, hasAreaSelected, onMapCenterChange, onAutoSelectArea }: ChatSetupProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hey! 👋 I'll help you create canvassing packets. Where do you want to canvass? (US locations only)",
      timestamp: new Date(),
    }
  ]);

  const [step, setStep] = useState<Step>('areaChoice');
  const [config, setConfig] = useState<Partial<EventConfig>>({});
  const [inputValue, setInputValue] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([
    { label: '📍 Give an address', value: 'address' },
    { label: '✏️ Draw on map', value: 'draw' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [useAddressMethod, setUseAddressMethod] = useState(false);

  const addMessage = (type: 'bot' | 'user', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleQuickReply = async (reply: QuickReply) => {
    addMessage('user', reply.label);
    setQuickReplies([]);

    await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for natural feel

    switch (step) {
      case 'areaChoice':
        if (reply.value === 'address') {
          setUseAddressMethod(true);
          addMessage('bot', "Perfect! What's the address or landmark? (US locations only)");
          setStep('address');
        } else {
          setUseAddressMethod(false);
          setConfig({ ...config, startingLocation: 'Map area' });
          addMessage('bot', "Got it! How many volunteers are coming?");
          setStep('volunteers');
        }
        break;

      case 'groupSize':
        setConfig({ ...config, groupSize: reply.value });
        addMessage('bot', "Do volunteers have access to cars?");
        setQuickReplies(CAR_AVAILABILITY);
        setStep('cars');
        break;

      case 'cars':
        setConfig({ ...config, carAvailability: reply.value });
        addMessage('bot', "Perfect! How many doors should each team knock? (This determines the size of each walking route)");
        setQuickReplies(PRESET_DOOR_COUNTS);
        setStep('doors');
        break;

      case 'doors':
        setConfig({ ...config, doorsPerPacket: reply.value });
        if (useAddressMethod) {
          // They gave an address, so area is already created - check if we can generate
          if (hasAreaSelected) {
            addMessage('bot', "Perfect! Ready to generate your packets?");
            setStep('drawPrompt');
          } else {
            addMessage('bot', "Now adjust the area on the map if needed using the Radius or Polygon buttons!");
            setStep('drawPrompt');
          }
        } else {
          addMessage('bot', "Last step - draw your canvassing area on the map using the Radius or Polygon buttons above!");
          setStep('drawPrompt');
        }
        break;
    }
  };

  const handleTextSubmit = async () => {
    if (!inputValue.trim()) return;

    const userInput = inputValue;
    addMessage('user', userInput);
    setInputValue('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    switch (step) {
      case 'address':
        // Geocode the address
        const result = await geocodeUSAddress(userInput);

        if (result && result.isValid) {
          setConfig({ ...config, startingLocation: result.displayName });

          // Center the map on the geocoded location
          onMapCenterChange(result.location, 15);

          // Auto-create a 1km radius area around the location
          onAutoSelectArea(result.location, 1000);

          // Confirm the found address
          addMessage('bot', `✓ Found it: ${result.displayName}`);
          await new Promise(resolve => setTimeout(resolve, 400));
          addMessage('bot', `I've created a ~1km radius area around it. You can redraw it if you want. How many volunteers are coming?`);
          setStep('volunteers');
        } else {
          addMessage('bot', "Hmm, I couldn't find that address in the US. Can you try again with a different address or landmark?");
          // Stay on address step
        }
        break;

      case 'volunteers':
        const volunteerCount = parseInt(userInput);
        if (volunteerCount > 0) {
          setConfig({ ...config, volunteers: volunteerCount });
          addMessage('bot', "Perfect! Should they go out solo, in pairs, or in groups?");
          setQuickReplies(PRESET_GROUP_SIZES);
          setStep('groupSize');
        } else {
          addMessage('bot', "Please enter a valid number of volunteers.");
        }
        break;
    }

    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (hasAreaSelected && config.volunteers && config.groupSize && config.doorsPerPacket) {
      const packetCount = Math.ceil(config.volunteers! / config.groupSize!);
      const totalDoors = packetCount * config.doorsPerPacket!;

      addMessage('user', 'Generate packets!');
      setIsLoading(true);
      addMessage('bot', '🔍 Analyzing street network and creating walkable routes...');

      // Call the completion handler (which will generate packets)
      await onComplete(config as EventConfig);

      // Wait a moment for packets to generate
      await new Promise(resolve => setTimeout(resolve, 1000));

      setIsLoading(false);
      addMessage('bot', `🎉 Perfect! Created ${packetCount} packets following natural street boundaries with ~${config.doorsPerPacket} doors each (${totalDoors} doors total).`);
      setStep('complete');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleTextSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {/* Quick replies */}
        {quickReplies.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => handleQuickReply(reply)}
                className="px-4 py-2 bg-background border border-border rounded-full hover:bg-accent hover:border-primary transition-colors text-sm"
              >
                {reply.label}
                {reply.description && (
                  <span className="text-xs text-muted-foreground ml-2">{reply.description}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Generate button when ready */}
        {step === 'drawPrompt' && hasAreaSelected && !isLoading && (
          <div className="flex justify-center">
            <Button onClick={handleGenerate} size="lg" className="rounded-full">
              Generate My Packets 🎉
            </Button>
          </div>
        )}
      </div>

      {/* Input area */}
      {step !== 'complete' && quickReplies.length === 0 && (
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                step === 'address' ? 'Type an address...' :
                step === 'volunteers' ? 'Number of volunteers...' :
                'Type here...'
              }
              disabled={isLoading}
              className="rounded-full"
              autoFocus
            />
            <Button
              onClick={handleTextSubmit}
              disabled={!inputValue.trim() || isLoading}
              className="rounded-full"
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
