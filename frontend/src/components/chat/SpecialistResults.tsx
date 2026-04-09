import { motion } from 'framer-motion';
import { MapPin, Phone, Star, ChevronRight } from 'lucide-react';

export interface Specialist {
  name: string;
  specialty: string;
  address?: string;
  phone?: string;
  rating?: string;
  notes?: string;
}

function SpecialistCard({ specialist, isLast }: { specialist: Specialist; isLast: boolean }) {
  return (
    <div className={`py-4 group cursor-pointer ${!isLast ? 'border-b border-black/[0.06]' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary">
          <span className="text-[17px] font-semibold">{specialist.name.charAt(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
             <h4 className="text-[16px] font-semibold text-textMain group-hover:text-primary transition-colors">{specialist.name}</h4>
             <ChevronRight className="h-4 w-4 text-textMuted opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
          </div>
          <p className="text-[14px] text-textMuted font-medium mt-0.5">{specialist.specialty}</p>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            {specialist.address && (
              <div className="flex items-start gap-1.5 text-[13px] text-textMuted">
                <MapPin className="h-4 w-4 shrink-0 -mt-0.5" />
                <span className="truncate max-w-[200px]">{specialist.address}</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              {specialist.phone && (
                <div className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline">
                  <Phone className="h-4 w-4" />
                  <span>{specialist.phone}</span>
                </div>
              )}
              {specialist.rating && (
                <div className="flex items-center gap-1 text-[13px] text-amber-500 font-medium">
                  <Star className="h-4 w-4 fill-amber-500" />
                  <span>{specialist.rating}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpecialistResults({ specialists }: { specialists: Specialist[] }) {
  if (specialists.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex w-full justify-start mb-6"
    >
      <div className="w-full max-w-[85%] sm:max-w-[75%]">
         <div className="bg-white rounded-[24px] shadow-apple border border-black/[0.04] overflow-hidden">
            <div className="bg-surfaceLight px-5 py-3 border-b border-black/[0.04] flex items-center gap-2">
               <MapPin className="h-4 w-4 text-primary" />
               <span className="text-[13px] font-semibold text-textMain">Recommended Specialists</span>
               <span className="ml-auto bg-black/[0.06] text-textMuted px-2 py-0.5 rounded-full text-[11px] font-semibold">
                 {specialists.length} Nearby
               </span>
            </div>
            
            <div className="px-5">
              {specialists.map((specialist, index) => (
                <SpecialistCard 
                   key={`${specialist.name}-${index}`} 
                   specialist={specialist} 
                   isLast={index === specialists.length - 1}
                />
              ))}
            </div>
         </div>
      </div>
    </motion.div>
  );
}
