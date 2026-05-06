import React from 'react';

interface HelpTooltipProps {
  text: string;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ text }) => {
  return (
    <span className="help-tooltip">
      <span className="help-tooltip-trigger">?</span>
      <span className="help-tooltip-content">{text}</span>
    </span>
  );
};

export default HelpTooltip;
