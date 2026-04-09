import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type HealthProfile } from './store';
import { resetSystemData, scanFingerprintBloodGroup } from './api';
import { motion } from 'framer-motion';
import { ChevronLeft, UserCircle, MapPin, Activity, HelpCircle, Thermometer, Shield, UserX, User, Cpu, AlertCircle } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { healthProfile, setHealthProfile } = useChatStore();
  const [form, setForm] = useState<HealthProfile>(healthProfile);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanError, setScanError] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleChange = (field: keyof HealthProfile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    setHealthProfile(form);
    setTimeout(() => {
      setSaving(false);
      navigate('/');
    }, 500);
  };

  const handleBloodGroupScan = async () => {
    setScanning(true);
    setScanStatus('Scanning fingerprint...');
    setScanError('');

    try {
      const result = await scanFingerprintBloodGroup();
      handleChange('bloodGroup', result.blood_group);
      setScanStatus(`Match found: ${result.blood_group} • Conf. ${Math.round(result.confidence)}%`);
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Scanner timeout or disconnected.';
      setScanError(message);
      setScanStatus('');
    } finally {
      setScanning(false);
    }
  };

  const handleResetSystem = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to erase all data and settings? This action cannot be undone.'
    );
    if (!confirmed) return;

    setResetting(true);
    setScanError('');
    setScanStatus('');
    try {
      await resetSystemData();
      localStorage.clear();
      window.location.href = '/';
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Erase operation failed.';
      setScanError(message);
    } finally {
      setResetting(false);
    }
  };

  const profileFilled = form.name || form.age || form.conditions;

  const basicFields = [
    { key: 'name' as const, label: 'Legal Name', placeholder: 'John Appleseed', icon: <User className="w-4 h-4" /> },
    { key: 'location' as const, label: 'Location', placeholder: 'City or Region', icon: <MapPin className="w-4 h-4" /> },
  ];

  const medicalFields = [
    { key: 'conditions' as const, label: 'Conditions', placeholder: 'e.g., Hypertension', icon: <Activity className="w-4 h-4" /> },
    { key: 'allergies' as const, label: 'Allergies', placeholder: 'e.g., Penicillin', icon: <AlertCircle className="w-4 h-4" /> },
    { key: 'medications' as const, label: 'Medications', placeholder: 'e.g., Lisinopril 10mg', icon: <Shield className="w-4 h-4" /> },
  ];

  const numberFields = [
    { key: 'age' as const, label: 'Age (Years)', placeholder: '0', icon: <HelpCircle className="w-4 h-4" /> },
    { key: 'weight' as const, label: 'Weight (kg)', placeholder: '0.0', icon: <Activity className="w-4 h-4" /> },
    { key: 'height' as const, label: 'Height (cm)', placeholder: '0', icon: <Thermometer className="w-4 h-4" /> },
  ];

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  return (
    <div className="flex h-screen w-screen bg-background font-sans text-textMain selection:bg-primary/20 overflow-hidden">
      
      {/* Sidebar (like macOS Settings) */}
      <div className="w-64 border-r border-black/[0.06] bg-[#fdfdfd]/80 backdrop-blur-xl hidden md:flex flex-col">
         <div className="p-8 pb-4">
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
         </div>
         <div className="flex flex-col gap-1 px-4 mt-2">
            <button className="flex items-center gap-3 px-4 py-2 bg-primary text-white rounded-xl font-medium shadow-sm active:scale-[0.98] transition-all">
               <UserCircle className="w-4 h-4" strokeWidth={2.5} />
               Profile & Vitals
            </button>
            <button onClick={() => navigate('/chat')} className="flex items-center gap-3 px-4 py-2 hover:bg-black/[0.04] text-textMain rounded-xl font-medium active:scale-[0.98] transition-all">
               <Activity className="w-4 h-4 text-textMuted" strokeWidth={2.5} />
               Consultations
            </button>
             <button onClick={() => navigate('/autism-screening')} className="flex items-center gap-3 px-4 py-2 hover:bg-black/[0.04] text-textMain rounded-xl font-medium active:scale-[0.98] transition-all">
               <Cpu className="w-4 h-4 text-textMuted" strokeWidth={2.5} />
               Vision Module
            </button>
         </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Mobile Header / Actions */}
        <header className="glass-header flex items-center justify-between px-4 sm:px-8 py-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-primary hover:opacity-80 transition-opacity font-medium">
             <ChevronLeft className="w-5 h-5 -ml-1.5" strokeWidth={2.5} />
             <span className="hidden sm:inline">Back</span>
          </button>
          
          <h2 className="font-semibold absolute left-1/2 -translate-x-1/2">Profile</h2>

          <button 
             onClick={handleSave} 
             disabled={saving}
             className="text-primary font-semibold hover:opacity-80 active:opacity-60 transition-opacity"
          >
             {saving ? 'Saving...' : 'Done'}
          </button>
        </header>

        {/* Content */}
        <main className="custom-scrollbar flex-1 overflow-y-auto px-4 sm:px-8 pb-12 pt-6">
          <div className="max-w-2xl mx-auto space-y-10">
            
            {/* Header Icon */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
               <div className="w-24 h-24 rounded-full bg-blue-50 text-primary flex items-center justify-center shadow-apple-sm mb-4">
                  {profileFilled ? (
                    <span className="text-[40px] font-medium">{(form.name || 'U').charAt(0).toUpperCase()}</span>
                  ) : (
                    <UserCircle className="w-14 h-14" strokeWidth={1} />
                  )}
               </div>
               <h1 className="text-2xl font-medium">{form.name || 'Your Profile'}</h1>
               <p className="text-[15px] text-textMuted mt-1">MediSonar Health ID</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-6">
               
               {/* Identity */}
               <div>
                 <h2 className="text-[13px] font-semibold text-textMuted uppercase tracking-wide ml-4 mb-2">Identity</h2>
                 <div className="bg-surface rounded-2xl shadow-apple-sm overflow-hidden border border-black/[0.04]">
                   {basicFields.map((field, idx) => (
                     <div key={field.key} className={`flex items-center px-4 py-3 bg-surface ${idx !== basicFields.length - 1 ? 'border-b border-black/[0.06]' : ''}`}>
                        <div className="w-32 flex items-center gap-3 text-[15px] text-textMain font-medium">
                           <div className="p-1 rounded-md bg-black/[0.04] text-textMuted">{field.icon}</div>
                           {field.label}
                        </div>
                        <input
                           type="text"
                           value={form[field.key] || ''}
                           onChange={(e) => handleChange(field.key, e.target.value)}
                           placeholder={field.placeholder}
                           className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-textMuted"
                        />
                     </div>
                   ))}
                 </div>
               </div>

               {/* Biometrics */}
               <div>
                  <h2 className="text-[13px] font-semibold text-textMuted uppercase tracking-wide ml-4 mb-2">Biometrics</h2>
                  <div className="bg-surface rounded-2xl shadow-apple-sm overflow-hidden border border-black/[0.04]">
                     <div className="flex items-center px-4 py-3 bg-surface border-b border-black/[0.06]">
                        <div className="w-32 flex items-center gap-3 text-[15px] text-textMain font-medium">
                           <div className="p-1 rounded-md bg-black/[0.04] text-textMuted"><User className="w-4 h-4" /></div>
                           Sex
                        </div>
                        <select
                           value={form.gender || ''}
                           onChange={(e) => handleChange('gender', e.target.value)}
                           className="flex-1 bg-transparent text-[15px] outline-none text-textMain cursor-pointer"
                        >
                           <option value="" disabled className="text-textMuted">Select your sex</option>
                           {genderOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                     </div>

                     {numberFields.map((field, idx) => (
                        <div key={field.key} className={`flex items-center px-4 py-3 bg-surface ${idx !== numberFields.length - 1 ? 'border-b border-black/[0.06]' : ''}`}>
                           <div className="w-32 flex items-center gap-3 text-[15px] text-textMain font-medium">
                              <div className="p-1 rounded-md bg-black/[0.04] text-textMuted">{field.icon}</div>
                              {field.label}
                           </div>
                           <input
                              type="number"
                              value={form[field.key] || ''}
                              onChange={(e) => handleChange(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-textMuted"
                           />
                        </div>
                     ))}
                  </div>
               </div>

               {/* Medical History */}
               <div>
                 <h2 className="text-[13px] font-semibold text-textMuted uppercase tracking-wide ml-4 mb-2">Medical History</h2>
                 <div className="bg-surface rounded-2xl shadow-apple-sm overflow-hidden border border-black/[0.04]">
                   {medicalFields.map((field, idx) => (
                     <div key={field.key} className={`flex items-center px-4 py-3 bg-surface ${idx !== medicalFields.length - 1 ? 'border-b border-black/[0.06]' : ''}`}>
                        <div className="w-32 flex items-center gap-3 text-[15px] text-textMain font-medium">
                           <div className="p-1 rounded-md bg-black/[0.04] text-textMuted">{field.icon}</div>
                           {field.label}
                        </div>
                        <input
                           type="text"
                           value={form[field.key] || ''}
                           onChange={(e) => handleChange(field.key, e.target.value)}
                           placeholder={field.placeholder}
                           className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-textMuted"
                        />
                     </div>
                   ))}
                   <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 bg-surface border-t border-black/[0.06]">
                      <div className="w-32 flex items-center gap-3 text-[15px] text-textMain font-medium mb-3 sm:mb-0">
                         <div className="p-1 rounded-md bg-black/[0.04] text-textMuted"><Activity className="w-4 h-4" /></div>
                         Blood Type
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                         <select
                           value={form.bloodGroup || ''}
                           onChange={(e) => handleChange('bloodGroup', e.target.value)}
                           className="w-full sm:w-1/2 bg-transparent text-[15px] outline-none text-textMain cursor-pointer border sm:border-none border-black/[0.1] rounded-lg p-2 sm:p-0"
                         >
                           <option value="" disabled className="text-textMuted">Select group</option>
                           {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                         </select>
                         
                         <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                              onClick={handleBloodGroupScan}
                              disabled={scanning}
                              className="apple-button-secondary py-1 text-sm shrink-0 whitespace-nowrap"
                            >
                              {scanning ? 'Scanning...' : 'Scan Reader'}
                            </button>
                            {(scanStatus || scanError) && (
                              <span className={`text-[13px] font-medium leading-tight ${scanError ? 'text-destructive' : 'text-primary'}`}>
                                 {scanError || scanStatus}
                              </span>
                            )}
                         </div>
                      </div>
                   </div>
                 </div>
               </div>

               {/* Danger Zone */}
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="pt-6">
                 <button 
                   onClick={handleResetSystem}
                   disabled={resetting}
                   className="w-full bg-surface hover:bg-red-50 text-destructive text-[15px] font-semibold py-3.5 rounded-2xl shadow-apple-sm border border-black/[0.04] transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                 >
                   <UserX className="w-4 h-4" />
                   {resetting ? 'Erasing Data...' : 'Erase All Content and Settings'}
                 </button>
                 <p className="text-center text-[13px] text-textMuted mt-4 opacity-70 px-4">
                   Your health profile and conversation data are stored securely on your browser. 
                   Deleting this wipes all personal traces immediately.
                 </p>
               </motion.div>

            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
