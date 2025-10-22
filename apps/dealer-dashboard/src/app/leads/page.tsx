import { getRecentLeads } from '../../lib/db';
import { decryptToJson, canDecrypt, isDecryptedLead } from '../../lib/crypto';

interface Lead {
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  createdAt: number;
}


export default async function LeadsPage() {
  const leads = getRecentLeads(100);
  const canDecryptLeads = canDecrypt();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="mt-2 text-gray-600">
            Recent lead submissions from the AutoAgent widget
          </p>
        </div>

        {!canDecryptLeads && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Encryption Key Not Configured
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Set LEAD_ENC_KEY in your environment to decrypt and view lead details.
                    Without this key, only basic lead information is visible.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {leads.length === 0 ? (
              <li className="px-6 py-4 text-center text-gray-500">
                No leads found
              </li>
            ) : (
              leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} canDecrypt={canDecryptLeads} />
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LeadRow({ lead, canDecrypt }: { lead: Lead; canDecrypt: boolean }) {
  const date = new Date(lead.createdAt).toLocaleString();
  
  return (
    <li className="px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Lead {lead.id}
                  </p>
                  <p className="text-sm text-gray-500">
                    Vehicle: {lead.vehicleId} • VIN: {lead.vin || 'N/A'}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {date}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {canDecrypt ? (
            <DecryptedLeadDetails encPayload={lead.encPayload} />
          ) : (
            <span className="text-sm text-gray-500">Encrypted</span>
          )}
        </div>
      </div>
    </li>
  );
}

async function DecryptedLeadDetails({ encPayload }: { encPayload: string }) {
  try {
    const decrypted = await decryptToJson(encPayload);
    
    if (!isDecryptedLead(decrypted)) {
      return (
        <div className="text-sm text-red-500">
          Invalid lead data format
        </div>
      );
    }
    
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{decrypted.user.name}</div>
        <div className="text-gray-500">{decrypted.user.email}</div>
        {decrypted.user.phone && (
          <div className="text-gray-500">{decrypted.user.phone}</div>
        )}
        {decrypted.user.preferredTime && (
          <div className="text-gray-500">Prefers: {decrypted.user.preferredTime}</div>
        )}
      </div>
    );
  } catch {
    return (
      <div className="text-sm text-red-500">
        Decryption failed
      </div>
    );
  }
}
