import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { DsButton, DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function PlanningPage() {
  const { state, getPlan, sendMessage } = useTravelBrain()
  const navigate = useNavigate()
  const plan = getPlan() ?? state.lastTrace?.plan

  return (
    <ProductAppChrome title="التخطيط">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          خطة الرحلة
        </DsText>
        <DsText variant="callout" tone="secondary">
          مولَّدة من TravelBrain.planner — بيانات تجريبية فقط.
        </DsText>
        {!plan ? (
          <DsButton
            onClick={() => {
              void sendMessage('Plan a 4 night trip from Riyadh to Dubai')
              navigate('/chat')
            }}
          >
            أنشئ خطة
          </DsButton>
        ) : (
          <div className="rh-float-layer" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <DsText variant="heading">
              {plan.destination ?? 'وجهة'} · {plan.nights} ليالٍ
            </DsText>
            {plan.assumptions.map((a) => (
              <DsText key={a} variant="caption" tone="tertiary">
                {a}
              </DsText>
            ))}
            {plan.steps.map((step) => (
              <div key={step.id} className="rh-surface-signature" style={{ padding: 12 }}>
                <DsText variant="micro" tone="primary">
                  Day {step.dayOffset + 1} · {step.kind}
                </DsText>
                <DsText variant="callout">{step.title}</DsText>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProductAppChrome>
  )
}
