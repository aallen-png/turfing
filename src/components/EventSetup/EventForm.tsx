import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { EventConfig } from '../../types';

interface EventFormProps {
  onGenerate: (config: EventConfig) => void;
  hasAreaSelected: boolean;
}

export function EventForm({ onGenerate, hasAreaSelected }: EventFormProps) {
  const [config, setConfig] = useState<EventConfig>({
    startingLocation: '',
    volunteers: 10,
    groupSize: 2,
    doorsPerPacket: 30,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EventConfig, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventConfig, string>> = {};

    if (!config.startingLocation.trim()) {
      newErrors.startingLocation = 'Starting location is required';
    }
    if (config.volunteers <= 0) {
      newErrors.volunteers = 'Must be greater than 0';
    }
    if (config.groupSize <= 0) {
      newErrors.groupSize = 'Must be greater than 0';
    }
    if (config.doorsPerPacket <= 0) {
      newErrors.doorsPerPacket = 'Must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm() && hasAreaSelected) {
      onGenerate(config);
    }
  };

  const isFormValid =
    config.startingLocation.trim() !== '' &&
    config.volunteers > 0 &&
    config.groupSize > 0 &&
    config.doorsPerPacket > 0;

  const canGenerate = isFormValid && hasAreaSelected;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Setup</CardTitle>
        <CardDescription>
          Configure your canvassing event parameters
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startingLocation">Starting Location</Label>
            <Input
              id="startingLocation"
              placeholder="e.g., City Hall, 123 Main St"
              value={config.startingLocation}
              onChange={(e) => setConfig({ ...config, startingLocation: e.target.value })}
            />
            {errors.startingLocation && (
              <p className="text-xs text-destructive">{errors.startingLocation}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Where volunteers meet (for reference)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="volunteers">Number of Volunteers</Label>
            <Input
              id="volunteers"
              type="number"
              min="1"
              value={config.volunteers}
              onChange={(e) => setConfig({ ...config, volunteers: parseInt(e.target.value) || 0 })}
            />
            {errors.volunteers && (
              <p className="text-xs text-destructive">{errors.volunteers}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupSize">Group Size</Label>
            <Input
              id="groupSize"
              type="number"
              min="1"
              value={config.groupSize}
              onChange={(e) => setConfig({ ...config, groupSize: parseInt(e.target.value) || 0 })}
            />
            {errors.groupSize && (
              <p className="text-xs text-destructive">{errors.groupSize}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Usually 2 (pairs)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doorsPerPacket">Doors per Packet</Label>
            <Input
              id="doorsPerPacket"
              type="number"
              min="1"
              value={config.doorsPerPacket}
              onChange={(e) => setConfig({ ...config, doorsPerPacket: parseInt(e.target.value) || 0 })}
            />
            {errors.doorsPerPacket && (
              <p className="text-xs text-destructive">{errors.doorsPerPacket}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Target doors per walking route
            </p>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={!canGenerate}
            >
              {!hasAreaSelected ? 'Select an area first' : 'Generate Turf'}
            </Button>
            {!hasAreaSelected && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Draw an area on the map to get started
              </p>
            )}
          </div>

          {canGenerate && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Packets to generate:</span>{' '}
                {Math.ceil(config.volunteers / config.groupSize)}
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
