import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { EventConfig } from '../../types';
import { MapPin, Users, UserPlus, Home, Check } from 'lucide-react';

interface ConversationalSetupProps {
  onComplete: (config: EventConfig) => void;
  hasAreaSelected: boolean;
  onRequestAreaSelection: () => void;
}

type Step = 'welcome' | 'areaChoice' | 'location' | 'volunteers' | 'groupSize' | 'doors' | 'area' | 'complete';
type AreaInputMethod = 'address' | 'draw' | null;

const PRESET_GROUP_SIZES = [
  { value: 1, label: 'Solo', description: 'One person per route' },
  { value: 2, label: 'Pairs', description: 'Two people together (most common)' },
  { value: 3, label: 'Groups of 3', description: 'Small teams' },
];

const PRESET_DOOR_COUNTS = [
  { value: 30, label: '30 doors', description: 'Quick route (~30-45 min)' },
  { value: 50, label: '50 doors', description: 'Standard route (~1 hour)' },
  { value: 75, label: '75 doors', description: 'Long route (~1.5 hours)' },
];

export function ConversationalSetup({ onComplete, hasAreaSelected, onRequestAreaSelection }: ConversationalSetupProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [config, setConfig] = useState<Partial<EventConfig>>({});
  const [inputValue, setInputValue] = useState('');
  const [areaMethod, setAreaMethod] = useState<AreaInputMethod>(null);

  const handleNext = (value?: any) => {
    switch (step) {
      case 'welcome':
        setStep('areaChoice');
        break;
      case 'areaChoice':
        setAreaMethod(value);
        if (value === 'address') {
          setStep('location');
        } else {
          // Skip location, set a default
          setConfig({ ...config, startingLocation: 'Meeting point (TBD)' });
          setStep('volunteers');
        }
        break;
      case 'location':
        setConfig({ ...config, startingLocation: value || inputValue });
        setInputValue('');
        setStep('volunteers');
        break;
      case 'volunteers':
        setConfig({ ...config, volunteers: parseInt(value || inputValue) });
        setInputValue('');
        setStep('groupSize');
        break;
      case 'groupSize':
        setConfig({ ...config, groupSize: value });
        setStep('doors');
        break;
      case 'doors':
        setConfig({ ...config, doorsPerPacket: value });
        if (areaMethod === 'draw') {
          setStep('area');
        } else {
          // They provided an address, create area automatically (for now just complete)
          // TODO: Geocode the address and create a radius
          setStep('area'); // Still need them to draw for now
        }
        break;
      case 'area':
        if (hasAreaSelected) {
          setStep('complete');
          onComplete(config as EventConfig);
        } else {
          onRequestAreaSelection();
        }
        break;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleNext();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="space-y-4">
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Hey! 👋</h2>
              <p className="text-muted-foreground text-lg">
                Let's get your canvassing turf set up.
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                I'll ask you a few quick questions and we'll have packets ready in no time.
              </p>
            </div>
            <Button onClick={() => handleNext()} className="w-full" size="lg">
              Let's Go
            </Button>
          </div>
        );

      case 'areaChoice':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-medium mb-1">Where do you want to canvass?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  You can give me an address or draw the area yourself
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleNext('address')}
                    className="w-full p-4 border rounded-lg text-left hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="font-medium">📍 I'll give you an address</div>
                    <div className="text-sm text-muted-foreground">
                      Enter a location and we'll create an area around it
                    </div>
                  </button>
                  <button
                    onClick={() => handleNext('draw')}
                    className="w-full p-4 border rounded-lg text-left hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="font-medium">✏️ I'll draw it on the map</div>
                    <div className="text-sm text-muted-foreground">
                      Pick the exact streets you want to cover
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-medium mb-1">What's the address or landmark?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  I'll create a canvassing area around this spot - could be a park, intersection, neighborhood name, etc.
                </p>
                <Input
                  placeholder="Main St & 5th Ave, Lincoln Park, Downtown..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                  className="mb-2"
                />
                <Button
                  onClick={() => handleNext()}
                  disabled={!inputValue.trim()}
                  className="w-full"
                >
                  Got it →
                </Button>
              </div>
            </div>
          </div>
        );

      case 'volunteers':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                {areaMethod === 'address' && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">
                        Canvassing around {config.startingLocation}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-lg font-medium mb-1">Nice! How many people are showing up?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Just your best guess - everyone who's knocking doors
                </p>
                <Input
                  type="number"
                  placeholder="10"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                  min="1"
                  className="mb-2"
                />
                <Button
                  onClick={() => handleNext()}
                  disabled={!inputValue || parseInt(inputValue) <= 0}
                  className="w-full"
                >
                  Next →
                </Button>
              </div>
            </div>
          </div>
        );

      case 'groupSize':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="mb-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      {config.volunteers} volunteers coming
                    </span>
                  </div>
                </div>
                <p className="text-lg font-medium mb-1">Should people go out in pairs, solo, or groups?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Most folks do pairs - it's safer and more fun
                </p>
                <div className="space-y-2">
                  {PRESET_GROUP_SIZES.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleNext(preset.value)}
                      className="w-full p-4 border rounded-lg text-left hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-sm text-muted-foreground">{preset.description}</div>
                    </button>
                  ))}
                  <Input
                    type="number"
                    placeholder="Custom group size"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && inputValue) {
                        handleNext(parseInt(inputValue));
                      }
                    }}
                    min="1"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'doors':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Home className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="mb-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      Going out in groups of {config.groupSize}
                    </span>
                  </div>
                </div>
                <p className="text-lg font-medium mb-1">How many doors should each team hit?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  This sets the size of each walking route
                </p>
                <div className="space-y-2">
                  {PRESET_DOOR_COUNTS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleNext(preset.value)}
                      className="w-full p-4 border rounded-lg text-left hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-sm text-muted-foreground">{preset.description}</div>
                    </button>
                  ))}
                  <Input
                    type="number"
                    placeholder="Custom door count"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && inputValue) {
                        handleNext(parseInt(inputValue));
                      }
                    }}
                    min="1"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'area':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="mb-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      ~{config.doorsPerPacket} doors each
                    </span>
                  </div>
                </div>
                {areaMethod === 'address' ? (
                  <>
                    <p className="text-lg font-medium mb-1">Almost there! Now draw your area on the map</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {hasAreaSelected
                        ? '✓ Perfect! Ready to generate'
                        : `I'll center the area around "${config.startingLocation}" - just draw how big you want it`
                      }
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-1">Last step! Draw your area on the map</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {hasAreaSelected
                        ? '✓ Got it! Ready when you are'
                        : 'Use the Radius or Polygon buttons to draw exactly where you want to canvass'
                      }
                    </p>
                  </>
                )}
                {!hasAreaSelected ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm mb-2 font-medium">Quick guide:</p>
                    <ol className="text-sm space-y-1 text-muted-foreground">
                      <li>1. Click "Radius" or "Polygon" button above</li>
                      <li>2. Look for draw controls in the map corner</li>
                      <li>3. Draw your canvassing area</li>
                      <li>4. Come back here when done</li>
                    </ol>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleNext()}
                    className="w-full"
                    size="lg"
                  >
                    Make My Packets! 🎉
                  </Button>
                )}
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're all set! 🎉</h2>
              <p className="text-muted-foreground text-lg">
                Created {Math.ceil((config.volunteers || 0) / (config.groupSize || 1))} packets for your team
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Check them out on the map and in the list below!
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {renderStep()}
      </CardContent>
    </Card>
  );
}
