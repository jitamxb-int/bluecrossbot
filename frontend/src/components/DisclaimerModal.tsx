import React from 'react';
import { X } from 'lucide-react';

const BLUE = '#1B3D8F';
const BLUE_L = '#3A6BC4';

interface DisclaimerModalProps {
    onAccept: () => void;
    onReject: () => void;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onAccept, onReject }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div
                className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                style={{
                    width: '700px',
                    maxWidth: '100%',
                    maxHeight: '80vh',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ background: BLUE }}
                >
                    <h2 className="text-white text-lg font-bold">Disclaimer & Consent</h2>
                    <button
                        onClick={onReject}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                        aria-label="Close disclaimer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div
                    className="overflow-y-auto px-6 py-4 text-sm leading-relaxed text-slate-700"
                    style={{ flex: '1 1 auto', minHeight: 0 }}
                >
                    <p>
                        The following disclaimer is intended to inform users of the limitations and usage guidelines of the AI chatbot available in the Blue Cross Labs (BCL) public documentation. Please read this disclaimer carefully before engaging with the chatbot.
                    </p>

                    <h3 className="font-bold text-slate-800 mt-5 mb-2">General Information:</h3>
                    <p>
                        The AI chatbot is an automated system designed to provide information and assistance based on the public BCL documentation. While we strive to provide accurate information through the AI chatbot, we cannot guarantee the accuracy, completeness, or up-to-date nature of the information provided.
                    </p>

                    <h3 className="font-bold text-slate-800 mt-5 mb-2">User Responsibility:</h3>
                    <p>
                        Users of the AI chatbot bear sole responsibility for their interactions and reliance on the information provided. It is important to exercise caution and use your discretion while interpreting and acting upon the chatbot's responses. We cannot be held liable for any actions, losses, or damages resulting from the use of the chatbot.
                    </p>

                    <h3 className="font-bold text-slate-800 mt-5 mb-2">Data Privacy and Security:</h3>
                    <p>
                        We prioritize the privacy and security of our users' information. Be aware that chatbot conversations may be reviewed by our content team to improve results. While the system retains logs of these conversations for 30 days, this data is not used to train AI models. Do not share any sensitive or personal information in your conversations.
                    </p>

                    <p className="mt-4">
                        By using our AI chatbot, you indicate your acceptance and understanding of the above disclaimer. If you do not agree with any part of this disclaimer, we recommend refraining from using the chatbot. For further assistance or inquiries, please contact Support at the designated email address.
                    </p>

                    <hr className="my-6 border-slate-200" />

                    <h3 className="font-bold text-slate-800 mb-2">HCP Consent and Disclaimer</h3>
                    <p>
                        This information is intended for healthcare professionals. Any medical decision-making should rely on clinical judgment and independently verified information. The content provided herein does not replace professional discretion and should be considered supplementary to established clinical guidelines. Healthcare providers should verify all information against primary literature and current practice standards before application in patient care. Blue Cross Labs assumes no liability for clinical decisions based on this content.
                    </p>
                </div>

                {/* Buttons */}
                <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex justify-end gap-3">
                    <button
                        onClick={onReject}
                        className="px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
                        style={{
                            background: 'white',
                            color: BLUE,
                            border: `1px solid ${BLUE}`,
                        }}
                    >
                        REJECT
                    </button>
                    <button
                        onClick={onAccept}
                        className="px-6 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                        style={{
                            background: BLUE,
                            color: 'white',
                        }}
                    >
                        ACCEPT
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisclaimerModal;
