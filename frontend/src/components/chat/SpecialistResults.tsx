import { motion } from 'framer-motion';
import { MapPin, Phone, Star, Stethoscope } from 'lucide-react';

export interface Specialist {
  name: string;
  specialty: string;
  address?: string;
  phone?: string;
  rating?: string;
  notes?: string;
}

function SpecialistCard({ specialist }: { specialist: Specialist }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="specialist-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceLight">
          <Stethoscope className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-textMain">{specialist.name}</h4>
          <p className="mt-0.5 text-xs text-primary">{specialist.specialty}</p>
          {specialist.address && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-textMuted">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{specialist.address}</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            {specialist.phone && (
              <div className="flex items-center gap-1 text-xs text-textMuted">
                <Phone className="h-3 w-3" />
                <span>{specialist.phone}</span>
              </div>
            )}
            {specialist.rating && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <Star className="h-3 w-3" />
                <span>{specialist.rating}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function SpecialistResults({ specialists }: { specialists: Specialist[] }) {
  if (specialists.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex w-full justify-start"
    >
      <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surfaceLight">
        <Stethoscope className="h-4 w-4 text-primary" />
      </div>
      <div className="max-w-[85%] space-y-2 sm:max-w-[75%]">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-textMuted">
          <MapPin className="h-3 w-3" /> Specialists Near You
        </p>
        {specialists.map((specialist, index) => (
          <SpecialistCard key={`${specialist.name}-${index}`} specialist={specialist} />
        ))}
        <p className="mt-2 text-[11px] italic text-textMuted">
          Results come from grounded search. Please verify details before visiting.
        </p>
      </div>
    </motion.div>
  );
}
