
// client/src/components/UserCard.js
import React from 'react';
import { Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const UserCard = ({ user, onSendRequest }) => {
  const { user: currentUser } = useAuth();

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <Card className="user-card shadow-sm">
      <Card.Body className="text-center">
        <div className="d-flex justify-content-center mb-3">
          {user.profilePhoto ? (
            <img 
              src={user.profilePhoto} 
              alt={user.name}
              className="profile-photo"
            />
          ) : (
            <div 
              className="profile-photo d-flex align-items-center justify-content-center bg-secondary text-white"
              style={{ fontSize: '1.5rem' }}
            >
              {getInitials(user.name)}
            </div>
          )}
        </div>
        
        <Card.Title className="h5">{user.name}</Card.Title>
        
        {user.location && (
          <Card.Subtitle className="mb-2 text-muted">
            📍 {user.location}
          </Card.Subtitle>
        )}
        
        <div className="mb-3">
          <div className="mb-2">
            <small className="text-muted">Skills Offered:</small>
            <div>
              {user.skillsOffered.length > 0 ? (
                user.skillsOffered.map((skill, index) => (
                  <span key={index} className="skill-tag">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-muted">None listed</span>
              )}
            </div>
          </div>
          
          <div className="mb-2">
            <small className="text-muted">Skills Wanted:</small>
            <div>
              {user.skillsWanted.length > 0 ? (
                user.skillsWanted.map((skill, index) => (
                  <span key={index} className="skill-tag wanted">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-muted">None listed</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-3">
          <Badge bg="info">{user.availability}</Badge>
        </div>
        
        <div className="d-grid gap-2">
          <Button 
            variant="outline-primary" 
            as={Link} 
            to={/user/${user._id}}
          >
            View Profile
          </Button>
          {currentUser && currentUser.id !== user._id && (
            <Button 
              variant="primary" 
              onClick={() => onSendRequest(user)}
            >
              Send Request
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default UserCard;