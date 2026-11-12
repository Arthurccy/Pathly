interface BankSyncModalProps { isOpen: boolean; onClose: () => void; }
export const BankSyncModal = ({ isOpen, onClose }: BankSyncModalProps) => {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="bank-sync-title" className="max-w-md rounded-xl bg-white p-6 dark:bg-gray-800">
      <h2 id="bank-sync-title" className="text-lg font-semibold">Synchronisation bancaire indisponible</h2>
      <p className="my-4">Utilisez l’import CSV de votre banque. La connexion automatique sera proposée après la mise en place d’un connecteur sécurisé.</p>
      <button autoFocus onClick={onClose} className="rounded bg-blue-600 px-4 py-2 text-white">Fermer</button>
    </section>
  </div>;
};
