// client/src/components/RequestModal.js
import React, { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";

const RequestModal = ({ show, onHide, targetUser }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    skillOffered: "",
    skillWanted: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.skillOffered || !formData.skillWanted) {
      toast.error("Please select both skills");
      return;
    }

    setLoading(true);

    try {
      await axios.post("/api/requests", {
        toUser: targetUser._id,
        skillOffered: formData.skillOffered,
        skillWanted: formData.skillWanted,
        message: formData.message,
      });

      toast.success("Request sent successfully!");
      onHide();
      setFormData({ skillOffered: "", skillWanted: "", message: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!user || !targetUser) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Send Skill Swap Request</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Alert variant="info">
            <strong>Requesting swap with:</strong> {targetUser.name}
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>Your Skill to Offer</Form.Label>
            <Form.Select
              name="skillOffered"
              value={formData.skillOffered}
              onChange={handleChange}
              required
            >
              <option value="">Select a skill you offer...</option>
              {user.skillsOffered.map((skill, index) => (
                <option key={index} value={skill}>
                  {skill}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Skill You Want from {targetUser.name}</Form.Label>
            <Form.Select
              name="skillWanted"
              value={formData.skillWanted}
              onChange={handleChange}
              required
            >
              <option value="">Select a skill they offer...</option>
              {targetUser.skillsOffered.map((skill, index) => (
                <option key={index} value={skill}>
                  {skill}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Message (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Add a personal message..."
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Request"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RequestModal;
