import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type HealthProfile } from './store';
import { scanFingerprintBloodGroup } from './api';
import { motion } from 'framer-motion';
import { ArrowLeft, UserCircle, Save, HeartPulse, Shield, MapPin, Pill, AlertTriangle, Calendar, Activity, MessageSquare, Weight, Ruler, Droplets, Fingerprint, ScanFace } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { healthProfile, setHealthProfile, sessions } = useChatStore();
  const [form, setForm] = useState<HealthProfile>(healthProfile);
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanError, setScanError] = useState('');

  const handleChange = (field: keyof HealthProfile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setHealthProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBloodGroupScan = async () => {
    setScanning(true);
    setScanStatus('Place a finger on the R307S scanner.');
    setScanError('');

    try {
      const result = await scanFingerprintBloodGroup();
      handleChange('bloodGroup', result.blood_group);
      setScanStatus(`Detected ${result.blood_group} with ${result.confidence.toFixed(2)}% confidence.`);
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Fingerprint scan failed. Check the scanner connection and backend setup.';
      setScanError(message);
      setScanStatus('');
    } finally {
      setScanning(false);
    }
  };

  const profileFilled = form.name || form.age || form.conditions;
  const totalChats = sessions.length;

  const textFields = [
    { key: 'name' as const, label: 'Full Name', placeholder: 'John Doe', icon: <UserCircle className="w-4 h-4 text-textMuted" /> },
    { key: 'location' as const, label: 'Location / City', placeholder: 'New York, USA', icon: <MapPin className="w-4 h-4 text-textMuted" /> },
    { key: 'conditions' as const, label: 'Existing Conditions', placeholder: 'Diabetes, Hypertension...', icon: <HeartPulse className="w-4 h-4 text-textMuted" /> },
    { key: 'allergies' as const, label: 'Known Allergies', placeholder: 'Penicillin, Peanuts...', icon: <AlertTriangle className="w-4 h-4 text-textMuted" /> },
    { key: 'medications' as const, label: 'Current Medications', placeholder: 'Metformin 500mg...', icon: <Pill className="w-4 h-4 text-textMuted" /> },
  ];

  const numberFields = [
    { key: 'age' as const, label: 'Age', placeholder: '30', unit: 'years', icon: <Calendar className="w-4 h-4 text-textMuted" /> },
    { key: 'weight' as const, label: 'Weight', placeholder: '70', unit: 'kg', icon: <Weight className="w-4 h-4 text-textMuted" /> },
    { key: 'height' as const, label: 'Height', placeholder: '175', unit: 'cm', icon: <Ruler className="w-4 h-4 text-textMuted" /> },
  ];

  const genderOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

  return (
    <div className="flex h-screen w-screen bg-background text-textMain font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between p-5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 hover:bg-surfaceLight rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-textMuted" />
            </button>
            <h1 className="text-base font-medium tracking-wide">Health Profile</h1>
          </div>
          {saved && (
            <motion.span
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-green-400 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Saved
            </motion.span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Profile Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-border rounded-2xl p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-surfaceLight border border-border flex items-center justify-center mx-auto mb-4">
                {profileFilled ? (
                  <span className="text-2xl font-medium text-primary">
                    {(form.name || 'U').charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <UserCircle className="w-10 h-10 text-textMuted" />
                )}
              </div>
              <h2 className="text-xl font-light tracking-wide">
                {form.name || 'Set Your Name'}
              </h2>
              <p className="text-sm text-textMuted mt-1">
                {profileFilled ? 'Your health profile is active' : 'Complete your profile for personalized AI responses'}
              </p>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-3 gap-4"
            >
              {[
                { icon: <MessageSquare className="w-4 h-4" />, label: 'Chats', value: totalChats },
                { icon: <Shield className="w-4 h-4" />, label: 'Status', value: profileFilled ? 'Active' : 'Incomplete' },
                { icon: <Activity className="w-4 h-4" />, label: 'Location', value: form.location || 'Not set' },
              ].map((stat, i) => (
                <div key={i} className="bg-surface border border-border rounded-xl p-4 text-center">
                  <div className="flex justify-center mb-2 text-textMuted">{stat.icon}</div>
                  <p className="text-lg font-medium">{stat.value}</p>
                  <p className="text-[10px] text-textMuted uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Text Fields */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface border border-border rounded-2xl p-6 space-y-5"
            >
              <h3 className="text-sm font-medium text-textMuted uppercase tracking-wider mb-4">Personal Information</h3>
              {textFields.map((f) => (
                <div key={f.key}>
                  <label className="flex items-center gap-2 text-xs text-textMuted mb-2">
                    {f.icon}
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={form[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-border text-textMain placeholder-textMuted transition-colors"
                  />
                </div>
              ))}
            </motion.div>

            {/* Number Fields with Units */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-surface border border-border rounded-2xl p-6 space-y-5"
            >
              <h3 className="text-sm font-medium text-textMuted uppercase tracking-wider mb-4">Physical Details</h3>
              <div className="grid grid-cols-3 gap-4">
                {numberFields.map((f) => (
                  <div key={f.key}>
                    <label className="flex items-center gap-2 text-xs text-textMuted mb-2">
                      {f.icon}
                      {f.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={form[f.key]}
                        onChange={(e) => handleChange(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-12 text-sm outline-none focus:border-border text-textMain placeholder-textMuted transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-textMuted pointer-events-none">
                        {f.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Gender & Blood Group */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="bg-surface border border-border rounded-2xl p-6 space-y-5"
            >
              <h3 className="text-sm font-medium text-textMuted uppercase tracking-wider mb-4">Additional Details</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Gender */}
                <div>
                  <label className="flex items-center gap-2 text-xs text-textMuted mb-2">
                    <UserCircle className="w-4 h-4 text-textMuted" />
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-border text-textMain transition-colors appearance-none"
                  >
                    <option value="">Select gender</option>
                    {genderOptions.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="flex items-center gap-2 text-xs text-textMuted mb-2">
                    <Droplets className="w-4 h-4 text-textMuted" />
                    Blood Group
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={form.bloodGroup}
                      onChange={(e) => handleChange('bloodGroup', e.target.value)}
                      className="min-w-0 flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-border text-textMain transition-colors appearance-none"
                    >
                      <option value="">Select blood group</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleBloodGroupScan}
                      disabled={scanning}
                      className="shrink-0 bg-white text-black border border-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <Fingerprint className="w-4 h-4" />
                      {scanning ? 'Scanning...' : 'Scan'}
                    </button>
                  </div>
                  {(scanStatus || scanError) && (
                    <p className={`mt-2 text-xs ${scanError ? 'text-red-400' : 'text-green-400'}`}>
                      {scanError || scanStatus}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Save Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              <div className="mb-4 rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-textMuted">Vision Module</p>
                    <h3 className="mt-1 text-base font-medium">Need the autism camera workflow?</h3>
                    <p className="mt-2 text-sm text-textMuted">
                      Open the dedicated vision page to use your laptop webcam or an external browser-detected camera.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/autism-screening')}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:bg-surfaceLight"
                  >
                    <ScanFace className="w-4 h-4" />
                    Open vision page
                  </button>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full py-3.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <Save className="w-4 h-4" />
                {saved ? 'Saved!' : 'Save Profile'}
              </button>
            </motion.div>

            <p className="text-center text-[11px] text-textMuted font-medium tracking-wide pb-4">
              Your profile data stays local and is only used to personalize your MediSonar experience.
            </p>
            <p className="text-center text-[11px] text-textMuted font-medium tracking-wide pb-4">
              Fingerprint blood-group output is experimental and should be verified with a standard test.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
