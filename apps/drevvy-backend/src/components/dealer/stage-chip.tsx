import {
  FILTER_LABEL,
  formatMoney,
  STAGE_ENDS,
  STAGE_LABEL,
  STAGE_PATH,
} from '@/lib/dealer/format';
import type {
  ConversationStage,
  InboxFilter,
  SlaChip,
} from '@/lib/dealer/types';

const STAGE_CLASS: Record<ConversationStage, string> = {
  new_request: 'bg-[#E3EEFF] text-[#2257C0]',
  in_conversation: 'bg-[#FFF0D6] text-[#8A5300]',
  numbers_shared: 'bg-[#ECEAFF] text-[#3C30C4]',
  closed: 'bg-[#E7EAF1] text-[#4E5568]',
  car_sold: 'bg-[#F4E9E4] text-[#7A4A3A]',
  no_reply: 'bg-[#EEEAF3] text-[#5E5470]',
};

const SLA_CLASS: Record<SlaChip['tone'], string> = {
  waiting: 'text-[#2257C0]',
  overdue: 'text-[#B42828]',
  replied: 'text-[#0F7A55]',
  ended: 'text-[#5E5470]',
};

export function StageChip({
  stage,
  label,
}: {
  stage: ConversationStage;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_CLASS[stage]}`}
    >
      {label}
    </span>
  );
}

export function SlaText({ sla }: { sla: SlaChip }) {
  return (
    <span className={`text-[11px] font-semibold ${SLA_CLASS[sla.tone]}`}>
      {sla.label}
    </span>
  );
}

export function StageStepper({ stage }: { stage: ConversationStage }) {
  const ended = STAGE_ENDS.includes(stage);
  const currentIndex = STAGE_PATH.indexOf(stage);

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] font-semibold">
      {STAGE_PATH.map((step, index) => {
        const current = !ended && step === stage;
        const done = !ended && currentIndex > index;
        return (
          <li
            key={step}
            className={
              current
                ? 'text-[#3C30C4]'
                : done
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            }
          >
            {index > 0 ? (
              <span className="mx-1 text-muted-foreground">→</span>
            ) : null}
            {STAGE_LABEL[step]}
          </li>
        );
      })}
      {ended ? (
        <li className="text-[#5E5470]">
          <span className="mx-1">·</span>
          {STAGE_LABEL[stage]}
        </li>
      ) : null}
    </ol>
  );
}

export function PriceLine({
  advertisedPriceCents,
  statedPriceCents,
  priceDiffers,
}: {
  advertisedPriceCents: number;
  statedPriceCents: number | null;
  priceDiffers: boolean;
}) {
  return (
    <div className="text-xs leading-5 text-muted-foreground">
      <p>
        Advertised {formatMoney(advertisedPriceCents)}
        {statedPriceCents != null
          ? ` · Stated ${formatMoney(statedPriceCents)}`
          : ''}
      </p>
      {priceDiffers ? (
        <p className="font-semibold text-[#8A5300]">
          Stated price differs from the advertised price.
        </p>
      ) : null}
    </div>
  );
}

export function filterLabel(filter: InboxFilter): string {
  return FILTER_LABEL[filter];
}
