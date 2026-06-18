import { useState } from 'react';
import { X, Phone, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import 'react-phone-number-input/style.css';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';

interface OutboundCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentType: string; // 'gs1' | 'case_manager' | 'hirebot'
}

export function OutboundCallModal({ isOpen, onClose, agentType }: OutboundCallModalProps) {
    const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
    const [provider, setProvider] = useState<'exotel' | 'twilio'>(agentType === 'hirebot' ? 'twilio' : 'exotel');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

    const handleCall = async () => {
        if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
            setErrorMessage('Please enter a valid phone number');
            setStatus('error');
            return;
        }

        setIsLoading(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            let response;
            
            // Use the GS1/CaseManager endpoint for these specific agents
            if (agentType === 'gs1' || agentType === 'case_manager') {
                const GS1_BACKEND = 'http://13.126.71.22:3005/api/call/outbound';
                
                // Set the correct Assistant ID based on agent type
                const assistantId = agentType === 'case_manager' 
                    ? '78c72414-f03d-4afe-9bd1-b6a6b3b293ad' 
                    : '57a22dc4-a12a-4396-9dc8-9c15bd2c553d';

                // Trunk IDs for the 3005 endpoint
                const trunkId = provider === 'twilio'
                    ? '69a02e42909fa360aa2e84ec'
                    : '69a02e89909fa360aa2e84f1';

                response = await fetch(GS1_BACKEND, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assistant_id: assistantId,
                        to_number: phoneNumber,
                        trunk_id: trunkId,
                        // Generating a valid 24-char hex user_id to avoid casting errors
                        user_id: '69a025c0909fa360aa2e8491', 
                    }),
                });
            } else {
                // Default backend for other agents (hirebot, etc.)
                const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

                response = await fetch(`${BACKEND_URL}/api/makeCall`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone_number: phoneNumber,
                        agent_type: agentType,
                        call_from: provider,
                    }),
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || 'Failed to initiate call');
            }

            // Specific success check for the GS1/CaseManager API structure
            if (agentType === 'gs1' || agentType === 'case_manager') {
                const responseData = await response.json().catch(() => null);
                if (!responseData || responseData.success !== true) {
                    throw new Error(responseData?.message || 'Outbound call failed');
                }
            }

            setStatus('success');
            setTimeout(() => {
                onClose();
                setStatus('idle');
                setPhoneNumber(undefined);
            }, 2000);

        } catch (err: any) {
            console.error("Outbound call failed:", err);
            setErrorMessage(err.message || "Failed to connect to server");
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white border border-gray-200 shadow-2xl rounded-3xl overflow-hidden transform transition-all">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Phone size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 leading-none">AI Outbound Call</h3>
                            <p className="text-sm text-gray-500 mt-1 capitalize">{agentType.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {status === 'success' ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 size={32} />
                            </div>
                            <h4 className="text-xl font-semibold text-gray-900">Call Initiated!</h4>
                            <p className="text-gray-500 mt-2">Check your phone, the agent is calling.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700 ml-1">Phone Number</label>
                                <div className="premium-phone-input">
                                    <PhoneInput
                                        international
                                        defaultCountry="IN"
                                        value={phoneNumber}
                                        onChange={setPhoneNumber}
                                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all"
                                        numberInputProps={{
                                            className: "w-full bg-transparent border-none outline-none text-gray-900 font-medium text-base",
                                            placeholder: "Enter phone number"
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700 ml-1">SIP Provider</label>
                                <div className={`grid gap-3 p-1 bg-gray-100 rounded-2xl relative ${agentType === 'hirebot' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {agentType !== 'hirebot' && (
                                        <button
                                            onClick={() => setProvider('exotel')}
                                            className={`relative z-10 py-2.5 text-sm font-bold rounded-xl transition-all ${provider === 'exotel' ? 'text-indigo-600 bg-white shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Exotel
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setProvider('twilio')}
                                        className={`relative z-10 py-2.5 text-sm font-bold rounded-xl transition-all ${provider === 'twilio' ? 'text-indigo-600 bg-white shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Twilio
                                    </button>
                                </div>
                            </div>

                            {status === 'error' && (
                                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <button
                                onClick={handleCall}
                                disabled={isLoading}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <><Loader2 size={20} className="animate-spin" /> Initiating...</>
                                ) : (
                                    <><Phone size={20} /> Call Now</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}