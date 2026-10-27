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
  new_request: 'c-new',
  in_conversation: 'c-chat',
  numbers_shared: 'c-wait',
  closed: 'c-no',
  car_sold: 'c-sold',
  no_reply: 'c-no',
};

const SLA_CLASS: Record<SlaChip['tone'], string> = {
  waiting: 'c-wait',
  overdue: 'c-no',
  replied: 'c-sold',
  ended: 'c-no',
};

export function StageChip({
  stage,
  label,
}: {
  stage: ConversationStage;
  label: string;
}) {
  return <span className={`chip ${STAGE_CLASS[stage]}`}>{label}</span>;
}

export function SlaText({ sla }: { sla: SlaChip }) {
  return <span className={`chip ${SLA_CLASS[sla.tone]}`}>{sla.label}</span>;
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
            className={current ? 'ok' : done ? undefined : 'mut'}
          >
            {index > 0 ? <span className="mut mx-1">→</span> : null}
            {STAGE_LABEL[step]}
          </li>
        );
      })}
      {ended ? (
        <li className="mut">
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
    <div className="mut">
      <p>
        Advertised {formatMoney(advertisedPriceCents)}
        {statedPriceCents != null
          ? ` · Stated ${formatMoney(statedPriceCents)}`
          : ''}
      </p>
      {priceDiffers ? (
        <p className="c-wait" style={{ fontWeight: 700 }}>
          Stated price differs from the advertised price.
        </p>
      ) : null}
    </div>
  );
}

export function filterLabel(filter: InboxFilter): string {
  return FILTER_LABEL[filter];
}
